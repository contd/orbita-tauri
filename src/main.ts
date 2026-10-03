import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getKubeconfigContextNames, validateKubeconfig } from "./kubeconfig";
import { parseKubectlCommand } from "./terminal";
import {
  age, ageDate, clock, compareValues, definitions, demo, escapeHtml, getDef, groups, highlightYaml, identity,
  manifestYaml, namespace, nodeReady, rowStatus, statusTone, workloadReadiness,
  type Resource, type ResourceKey,
} from "./model";

type View = "dashboard" | "settings" | "about" | ResourceKey;

const root = document.querySelector<HTMLElement>("#app")!;
const defaults = { theme: "dark", density: "normal", searchPath: "~/.kube", namespace: "All namespaces", selectedContext: "test-context", savedConfigs: [] as { id: string; name: string; yaml: string }[] };
let settings = (() => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem("orbita-preferences") ?? "{}") }; }
  catch { return { ...defaults }; }
})();
let view: View = "dashboard";
let search = "";
let sort = { column: "Name", direction: 1 };
let inspector: Resource | null = null;
let dialog: "add-config" | null = null;
let collapsed = new Set<string>();
let cli = { kubectl: false, docker: false, kind: false };
let cliChecking = true;
let cliPaths: Record<string, string> = {};
let terminalExpanded = false;
let terminalInput = "";
let terminalOutput = "";
let terminalStatus: string | null = null;
let terminalHistory: { command: string; output: string; status: string }[] = [];
const baseContexts = ["test-context", "staging-us-west", "local-kind"];
let contextNames = [...new Set([...baseContexts, settings.selectedContext])];
let selectedContext = settings.selectedContext;
/** In demo mode, contexts come from the built-in set plus saved pasted kubeconfigs. */
function syncDemoContexts(): void {
  if (bridged()) return;
  contextNames = [...new Set([...baseContexts, ...settings.savedConfigs.flatMap((c: { yaml: string }) => getKubeconfigContextNames(c.yaml))])];
  if (!contextNames.includes(selectedContext)) { selectedContext = contextNames[0]; settings.selectedContext = selectedContext; }
}
const initialKeys: ResourceKey[] = ["namespaces", "nodes", "pods", "deployments", "daemonsets", "statefulsets", "events"];
let loaded = new Set<ResourceKey>(initialKeys);
let terminalOpen = false;
let terminalStderr = "";
let logs: { title: string; body: string; state: "loading" | "ready" | "error" | "empty"; opener: string } | null = null;
let about = { name: "Orbita", version: "0.1.0", description: "A focused workspace for Kubernetes cluster inspection.", author: "Orbita contributors", email: "", repository: "https://github.com/orbita" };
const logKinds = new Set<ResourceKey>(["pods", "deployments", "daemonsets", "statefulsets", "replicasets", "jobs", "nodes"]);

/** Bridge override used by automated tests; production uses the Tauri command bridge. */
type Bridge = (command: string, args?: Record<string, unknown>) => Promise<any>;
const mockBridge = (): Bridge | undefined => (window as unknown as { __ORBITA_BRIDGE__?: Bridge }).__ORBITA_BRIDGE__;
const bridged = (): boolean => Boolean(mockBridge()) || isTauri();
function call<T = any>(command: string, args?: Record<string, unknown>): Promise<T> {
  const mock = mockBridge();
  return mock ? mock(command, args) : invoke<T>(command, args);
}
let loadingCollections = new Set<ResourceKey>();
let notice = `Connected to ${selectedContext} · Showing deterministic demo data`;
let refreshTime = "Just now";
let settingsSaved = false;
let snapshot = { ...demo };

function icon(name: string): string {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    cluster: "M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5-16 9m0-9 16 9",
    search: "m20 20-4.4-4.4M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    refresh: "M20 7v5h-5M4 17v-5h5m-4 0a7 7 0 0 1 12-4l3 4M4 12l3 4a7 7 0 0 0 12-4",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-6v2m0 15v2m10-9h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0-1.4-1.4M6.3 6.3 4.9 4.9",
    sun: "M12 3v2m0 14v2M3 12h2m14 0h2m-3.6-6.4-1.4 1.4m-8 8-1.4 1.4m12.2 0-1.4-1.4m-8-8L6.4 5.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z",
    copy: "M8 8V4h12v12h-4M4 8h12v12H4z",
    close: "m18 6-12 12M6 6l12 12",
    plus: "M12 5v14m-7-7h14",
    arrow: "M7 17 17 7M7 7h10v10",
    chevron: "m9 18 6-6-6-6",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] ?? paths.grid}"/></svg>`;
}
function saveSettings(): Promise<void> {
  localStorage.setItem("orbita-preferences", JSON.stringify(settings));
  if (!bridged()) return Promise.resolve();
  return call("save_preferences", { preferences: settings }).then(() => undefined).catch(error => {
    notice = `Could not persist settings: ${String(error)}`;
    render();
  });
}

function renderSidebar(): string {
  const nav = groups.map(group => {
    const defs = definitions.filter(d => d.group === group);
    const folded = collapsed.has(group);
    return `<section class="nav-group">
      <button class="group-heading" data-action="toggle-group" data-group="${escapeHtml(group)}" aria-expanded="${!folded}">
        <span>${escapeHtml(group)}</span><span class="group-chevron ${folded ? "folded" : ""}">${icon("chevron")}</span>
      </button>
      ${!folded ? `${group === "Cluster" ? `<button class="nav-item ${view === "dashboard" ? "active" : ""}" data-view="dashboard"><span class="nav-icon">${icon("grid")}</span><span class="nav-label">Dashboard</span></button>` : ""}${defs.map(d => {
        const count = loaded.has(d.key) ? snapshot[d.key]?.length ?? 0 : 0;
        const active = view === d.key;
        return `<button class="nav-item ${active ? "active" : ""}" data-view="${d.key}" title="${escapeHtml(d.label)}">
          <span class="nav-icon">${escapeHtml(d.icon)}</span><span class="nav-label">${escapeHtml(d.label)}</span>${count ? `<span class="nav-count">${count}</span>` : ""}
        </button>`;
      }).join("")}${group === "Cluster" ? `<button class="nav-add-config" data-action="add-config">${icon("plus")} Add kubeconfig</button>` : ""}` : ""}
    </section>`;
  }).join("");
  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">${icon("cluster")}</div><div><strong>orbita</strong><span>CLUSTER CONSOLE</span></div></div>
    <div class="cluster-card">
      <div class="cluster-topline"><span class="status-pulse"></span><span>ACTIVE CLUSTER</span><span class="connection-label">DEMO</span></div>
      <label for="context-select">Context</label><select id="context-select" aria-label="Current context">${contextNames.map(context => `<option value="${escapeHtml(context)}" ${selectedContext === context ? "selected" : ""}>${escapeHtml(context)}</option>`).join("")}</select>
      <div class="cluster-namespace"><span class="namespace-dot"></span><span>Namespace</span><strong>${escapeHtml(settings.namespace)}</strong></div>
    </div>
    <div class="nav-scroll">${nav}</div>
    <div class="sidebar-bottom">
      <button class="nav-item ${view === "settings" ? "active" : ""}" data-view="settings"><span class="nav-icon">${icon("settings")}</span><span class="nav-label">Settings</span></button>
      <div class="sidebar-user"><div class="avatar">O</div><div><strong>Orbita workspace</strong><span>Local environment</span></div><span class="more">···</span></div>
    </div>
  </aside>`;
}

function renderHeader(): string {
  const isDashboard = view === "dashboard";
  const title = view === "dashboard" ? "Dashboard" : view === "settings" ? "Settings" : view === "about" ? "About Orbita" : getDef(view).label;
  return `<header class="topbar">
    <div class="breadcrumb"><span>Cluster</span><span class="crumb-sep">/</span><strong>${escapeHtml(title)}</strong></div>
    <div class="top-actions">
      ${isDashboard || typeof view === "string" && definitions.some(d => d.key === view) ? `<label class="global-search">${icon("search")}<input id="search-input" type="search" value="${escapeHtml(search)}" placeholder="Search resources..." aria-label="Search resources"><kbd>⌘ K</kbd></label>` : ""}
      ${isDashboard || (definitions.some(d => d.key === view) && getDef(view as ResourceKey).namespaced) ? `<label class="select-control header-select"><span>Namespace</span><select id="namespace-select" aria-label="Namespace">${["All namespaces", ...snapshot.namespaces.map(n => n.metadata.name)].map(n => `<option ${settings.namespace === n ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")}</select></label>` : ""}
      ${isDashboard || definitions.some(d => d.key === view) ? `<button class="icon-button" data-action="refresh" aria-label="Refresh cluster" title="Refresh cluster">${icon("refresh")}</button>` : ""}
      <div class="divider"></div>
      <button class="icon-button" data-action="toggle-theme" aria-label="Toggle light and dark theme" title="Toggle theme">${icon(settings.theme === "dark" ? "sun" : "moon")}</button>
      <label class="density-wrap" title="Density"><span class="density-icon">☷</span><select id="density-select" aria-label="Density"><option value="cozy" ${settings.density === "cozy" ? "selected" : ""}>Cozy</option><option value="normal" ${settings.density === "normal" ? "selected" : ""}>Normal</option><option value="compact" ${settings.density === "compact" ? "selected" : ""}>Compact</option></select></label>
      <button class="toolbar-button" data-action="open-terminal" aria-label="Open kubectl terminal"><span class="terminal-glyph">&gt;_</span><span>Terminal</span></button>
      <button class="toolbar-button" data-view="settings">${icon("settings")}<span>Settings</span></button>
    </div>
  </header>`;
}

function renderCli(): string {
  return `<div class="cli-status">${(["kubectl", "Docker", "kind"] as const).map(label => {
    const key = label.toLowerCase();
    const detected = cli[key as keyof typeof cli];
    const state = cliChecking ? "Checking availability" : detected ? "Detected" : "Not detected";
    return `<div class="cli-pill" data-cli="${key}" tabindex="0" role="img" aria-label="${label}: ${state}"><span class="cli-dot ${detected ? "up" : ""}"></span>${label}<span class="cli-tooltip" role="tooltip">${state}</span></div>`;
  }).join("")}</div>`;
}
function renderStatusBar(): string {
  return `<footer class="status-bar"><span class="cluster-connected"><span class="connected-dot"></span>Connected to <strong>${escapeHtml(selectedContext)}</strong></span><span class="status-sep">·</span><span class="status-namespace">${escapeHtml(settings.namespace)}</span>${renderCli()}<span class="status-spacer"></span><button class="status-button" data-action="open-terminal" aria-label="Open kubectl terminal in status bar"><span class="terminal-glyph">&gt;_</span> Terminal</button><span class="footer-meta">Orbita v${escapeHtml(about.version)}${bridged() ? "" : " · Demo mode"}</span></footer>`;
}

function ratio(ready: number, total: number): number { return total ? Math.max(0, Math.min(100, ready / total * 100)) : 0; }
function renderMetric(label: string, value: string, detail: string, pct: number, tone: string, symbol: string, target: ResourceKey): string {
  return `<button type="button" class="metric-card ${tone}" data-view="${target}" data-metric="${escapeHtml(label)}" aria-label="${escapeHtml(label)}: open ${escapeHtml(getDef(target).label)}">
    <div class="metric-top"><span class="metric-icon">${symbol}</span><span class="metric-kicker">${escapeHtml(label)}</span><span class="metric-menu">···</span></div>
    <div class="metric-value">${value}</div><div class="metric-detail">${escapeHtml(detail)}</div>
    <div class="metric-track"><span style="width:${Math.round(pct)}%"></span></div><div class="metric-footer"><span>${Math.round(pct)}% of total</span><span class="metric-trend">●&nbsp; Live</span></div>
  </button>`;
}
function renderDashboard(): string {
  const pods = snapshot.pods;
  const running = pods.filter(p => p.status?.phase === "Running").length;
  const nodes = snapshot.nodes;
  const readyNodes = nodes.filter(nodeReady).length;
  const workloadItems = [...snapshot.deployments, ...snapshot.daemonsets, ...snapshot.statefulsets];
  const desired = workloadItems.reduce((n, r) => n + workloadReadiness(r).desired, 0);
  const ready = workloadItems.reduce((n, r) => n + workloadReadiness(r).ready, 0);
  const warnings = snapshot.events.filter(e => e.type === "Warning").length + nodes.length - readyNodes;
  const pctPods = ratio(running, pods.length), pctNodes = ratio(readyNodes, nodes.length), pctWorkloads = ratio(ready, desired);
    return `<div class="page-content dashboard-page">
    <div class="page-title-row">
      <div><div class="eyebrow">OVERVIEW <span>·</span> OCT 03, 2026</div><h1>Good morning, operator <span class="wave">✦</span></h1><p class="page-subtitle">Here's what's happening across your cluster today.</p></div>
      <div class="page-title-actions"><div class="live-indicator"><span></span>Live data</div><button class="button primary" data-action="add-config">${icon("plus")} Add cluster</button></div>
    </div>
    <div class="notice"><span class="notice-icon">i</span><span>${escapeHtml(notice)}</span><button aria-label="Dismiss notice" data-action="dismiss-notice">${icon("close")}</button></div>
    <div class="metric-grid">
      ${renderMetric("PODS RUNNING", `${running}<span class="metric-slash">/${pods.length}</span>`, `${pods.length - running} need attention`, pctPods, "blue", "▣", "pods")}
      ${renderMetric("NODES READY", `${readyNodes}<span class="metric-slash">/${nodes.length}</span>`, `${nodes.length - readyNodes} node needs attention`, pctNodes, "mint", "⬡", "nodes")}
      ${renderMetric("WORKLOADS READY", `${ready}<span class="metric-slash">/${desired}</span>`, `${workloadItems.length} workloads across cluster`, pctWorkloads, "violet", "◫", "daemonsets")}
      ${renderMetric("WARNINGS", `${warnings}`, "Across events and node health", ratio(Math.max(0, 4 - warnings), 4), warnings ? "amber" : "mint", "⚠", "events")}
    </div>
    <div class="section-header"><div><h2>Cluster activity</h2><p>A quick look at your resources and recent activity.</p></div>
      <div class="dashboard-controls"><span class="last-updated">Updated ${escapeHtml(refreshTime)}</span></div>
    </div>
    <div class="overview-grid">
      <section class="panel resource-overview"><div class="panel-heading"><div><h3>Workload health</h3><p>Resource readiness by type</p></div><button class="subtle-button" data-view="deployments">View deployments ${icon("arrow")}</button></div>
        ${[
          ["Deployments", snapshot.deployments.length, snapshot.deployments.filter(r => (r.status?.readyReplicas ?? 0) >= (r.spec?.replicas ?? 0)).length, "▥"],
          ["StatefulSets", snapshot.statefulsets.length, snapshot.statefulsets.filter(r => (r.status?.readyReplicas ?? 0) >= (r.spec?.replicas ?? 0)).length, "▣"],
          ["DaemonSets", snapshot.daemonsets.length, snapshot.daemonsets.filter(r => (r.status?.numberReady ?? 0) >= (r.status?.desiredNumberScheduled ?? 0)).length, "⠿"],
        ].map(([label, total, healthy, glyph]) => `<div class="workload-row"><span class="workload-glyph">${glyph}</span><span class="workload-name">${label}</span><div class="workload-bar"><span style="width:${ratio(Number(healthy), Number(total))}%"></span></div><span class="workload-count">${healthy}/${total} ready</span><span class="workload-check ${Number(healthy) === Number(total) ? "" : "partial"}">${Number(healthy) === Number(total) ? "✓" : "!"}</span></div>`).join("")}
        <div class="panel-divider"></div><div class="mini-stats"><div><span class="mini-label">TOTAL PODS</span><strong>${pods.length}</strong></div><div><span class="mini-label">RUNNING</span><strong class="text-green">${running}</strong></div><div><span class="mini-label">PENDING</span><strong class="text-amber">${pods.filter(p => p.status?.phase === "Pending").length}</strong></div><div><span class="mini-label">RESTARTS</span><strong>${pods.reduce((n, p) => n + (p.status?.containerStatuses ?? []).reduce((x: number, c: any) => x + c.restartCount, 0), 0)}</strong></div></div>
      </section>
      <section class="panel events-panel"><div class="panel-heading"><div><h3>Recent events</h3><p>Latest activity across the cluster</p></div><button class="subtle-button" data-view="events">All events ${icon("arrow")}</button></div>
        <div class="events-list">${[...snapshot.events].sort((a, b) => Date.parse(b.lastTimestamp ?? "") - Date.parse(a.lastTimestamp ?? "")).slice(0, 4).map(e => `<div class="event-row"><span class="event-marker ${e.type === "Warning" ? "warn" : ""}">${e.type === "Warning" ? "!" : "✓"}</span><div class="event-copy"><strong>${escapeHtml(e.reason)} <span>${escapeHtml(e.involvedObject?.name)}</span></strong><p>${escapeHtml(e.message)}</p><small>${escapeHtml(namespace(e))} · ${escapeHtml(ageDate(e.lastTimestamp ?? ""))}</small></div><span class="event-count">${e.count && e.count > 1 ? `×${e.count}` : ""}</span></div>`).join("")}</div>
      </section>
    </div>
  </div>`;
}

function filteredResources(key: ResourceKey): Resource[] {
  const def = getDef(key);
  let list = snapshot[key] ?? [];
  if (def.namespaced && settings.namespace !== "All namespaces") list = list.filter(r => r.metadata.namespace === settings.namespace);
  const query = search.trim().toLowerCase();
  if (query) list = list.filter(r => [r.metadata.name, namespace(r), ...def.columns.map(column => column.value(r))].join(" ").toLowerCase().includes(query));
  const column = sort.column === "Name" ? (r: Resource) => r.metadata.name : def.columns.find(c => c.label === sort.column)?.value ?? ((r: Resource) => r.metadata.name);
  return [...list].sort((a, b) => {
    const x = column(a), y = column(b);
    return compareValues(x, y) * sort.direction;
  });
}
function renderResourceTable(key: ResourceKey): string {
  const def = getDef(key), rows = filteredResources(key);
  const columns = [{ label: "Name", value: (r: Resource) => r.metadata.name }, ...def.columns];
  return `<div class="page-content resource-page">
    <div class="page-title-row"><div><div class="eyebrow">${escapeHtml(def.group.toUpperCase())} <span>·</span> RESOURCE BROWSER</div><h1>${escapeHtml(def.label)}</h1><p class="page-subtitle">Inspect and manage ${escapeHtml(def.label.toLowerCase())} in your cluster.</p></div><div class="page-title-actions"><span class="resource-count">${loadingCollections.has(key) ? "Loading…" : `${rows.length} ${rows.length === 1 ? "resource" : "resources"}`}</span><button class="button secondary" data-action="refresh">${icon("refresh")} Refresh</button></div></div>${notice ? `<div class="notice"><span class="notice-icon">i</span><span>${escapeHtml(notice)}</span></div>` : ""}
    <div class="table-toolbar"><div class="table-context"><span class="context-symbol">${escapeHtml(def.icon)}</span><span>${escapeHtml(selectedContext)}</span><span class="crumb-sep">/</span><span>${escapeHtml(settings.namespace)}</span></div><div class="table-tools"><span class="data-count">${rows.length} items</span></div></div>
    <div class="table-shell"><table><thead><tr>${columns.map(c => `<th><button class="sort-button" data-sort="${escapeHtml(c.label)}">${escapeHtml(c.label)} ${sort.column === c.label ? `<span>${sort.direction > 0 ? "↑" : "↓"}</span>` : ""}</button></th>`).join("")}<th class="action-header"></th></tr></thead><tbody>
      ${rows.length ? rows.map(r => `<tr class="resource-row" data-resource="${escapeHtml(identity(r))}" tabindex="0" role="button" aria-label="Inspect ${escapeHtml(r.kind)} ${escapeHtml(r.metadata.name)}">${columns.map((c, i) => {
        const val = c.value(r);
        if (i === 0) return `<td><div class="name-cell"><span class="resource-avatar ${def.group.toLowerCase().replace(/ /g, "-")}">${escapeHtml(def.icon)}</span><span><strong>${escapeHtml(val)}</strong>${r.metadata.namespace ? `<small>${escapeHtml(r.metadata.namespace)}</small>` : ""}</span><span class="name-actions"><button class="name-action" data-action="open-resource" data-id="${escapeHtml(identity(r))}" aria-label="Open details for ${escapeHtml(val)}">Details</button>${logKinds.has(key) ? `<button class="name-action" data-action="open-logs" data-id="${escapeHtml(identity(r))}" data-log-opener="row:${escapeHtml(identity(r))}" aria-label="Open logs for ${escapeHtml(val)}">Logs</button>` : ""}</span></div></td>`;
        if (c.label === "Status" || c.label === "Type" && key === "events") return `<td><span class="status-cell ${statusTone(val)}"><i></i>${escapeHtml(val)}</span></td>`;
        if (key === "pods" && c.label === "Containers") return `<td><span class="container-squares">${(r.spec?.containers ?? []).map((container: any, j: number) => `<i class="${r.status?.containerStatuses?.[j]?.ready ? "ready" : "not-ready"}" title="${escapeHtml(container.name)}"></i>`).join("")}<small>${escapeHtml(val)}</small></span></td>`;
        if (c.label === "Labels") return `<td><button class="label-summary" data-labels="${escapeHtml(JSON.stringify(r.metadata.labels ?? {}))}" data-name="${escapeHtml(r.metadata.name)}">${escapeHtml(val)}</button></td>`;
        return `<td class="${/^\d+$/.test(val) ? "numeric-cell" : ""}">${escapeHtml(val || "-")}</td>`;
      }).join("")}<td><button class="row-more" aria-label="Inspect ${escapeHtml(r.metadata.name)}">${icon("chevron")}</button></td></tr>`).join("") : `<tr><td colspan="${columns.length + 1}"><div class="empty-state"><span>⌕</span><strong>No resources found</strong><p>Try changing the namespace or search term.</p><button data-action="clear-search" class="subtle-button">Clear search</button></div></td></tr>`}
    </tbody></table></div><div class="table-foot"><span>Showing <strong>${rows.length}</strong> of ${snapshot[key].length} resources</span><span>Synced ${escapeHtml(refreshTime)}</span></div>
  </div>`;
}

function renderInspector(): string {
  if (!inspector) return "";
  const r = inspector, labels = Object.entries(r.metadata.labels ?? {}).slice(0, 8);
  return `<div class="inspector-backdrop"><aside class="inspector" role="dialog" aria-modal="true" aria-label="${escapeHtml(r.kind)} inspector">
    <header class="inspector-header"><div><div class="eyebrow">RESOURCE INSPECTOR</div><h2>${escapeHtml(r.kind)}</h2></div><button class="icon-button" data-action="close-inspector" aria-label="Close inspector">${icon("close")}</button></header>
    <div class="inspector-identity"><span class="resource-avatar large">${escapeHtml(getDef(view as ResourceKey)?.icon ?? "◉")}</span><div><strong>${escapeHtml(r.metadata.name)}</strong><span>${escapeHtml(identity(r))}</span></div><button class="icon-button small" data-action="copy-name" title="Copy resource name" aria-label="Copy resource name">${icon("copy")}</button></div>
    <div class="inspector-facts"><div><span>NAMESPACE</span><strong>${escapeHtml(r.metadata.namespace ?? "Cluster-scoped")}</strong></div><div><span>STATUS</span><strong class="${statusTone(rowStatus(r, (view as ResourceKey)))}">${escapeHtml(rowStatus(r, view as ResourceKey))}</strong></div><div><span>AGE</span><strong>${escapeHtml(age(r))}</strong></div><div><span>LABELS</span><strong>${Object.keys(r.metadata.labels ?? {}).length}</strong></div></div>
    ${r.kind === "Event" ? `<section class="inspector-section"><h3>Event message</h3><p class="event-message">${escapeHtml(r.message ?? "-")}</p></section>` : ""}
    <section class="inspector-section"><div class="inspector-section-title"><h3>Labels</h3><span>${Object.keys(r.metadata.labels ?? {}).length}</span></div>${labels.length ? `<div class="inspector-labels">${labels.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v || '""')}</strong></div>`).join("")}</div>` : `<p class="muted-empty">No labels on this resource.</p>`}${Object.keys(r.metadata.labels ?? {}).length > 8 ? `<small class="muted-empty">Showing 8 of ${Object.keys(r.metadata.labels ?? {}).length} labels</small>` : ""}</section>
    <section class="inspector-section manifest-section"><div class="inspector-section-title"><h3>Manifest</h3><button class="subtle-button" data-action="copy-manifest">${icon("copy")} Copy YAML</button></div><pre class="yaml-manifest">${highlightYaml(manifestYaml(r))}</pre></section>
    <footer class="inspector-footer">${logKinds.has(view as ResourceKey) ? `<button class="button secondary" data-action="open-logs-inspector" data-log-opener="inspector" aria-label="Open logs for ${escapeHtml(r.metadata.name)}">View logs</button>` : ""}<button class="button secondary" data-action="copy-name">${icon("copy")} Copy resource name</button><button class="button primary" data-action="copy-manifest">${icon("copy")} Copy manifest</button></footer>
  </aside></div>`;
}

function renderSettings(): string {
  return `<div class="page-content settings-page"><div class="page-title-row"><div><div class="eyebrow">PREFERENCES <span>·</span> WORKSPACE</div><h1>Settings</h1><p class="page-subtitle">Configure how Orbita connects to your Kubernetes environment.</p></div><div class="page-title-actions"><button class="button secondary" data-view="dashboard">${icon("chevron")} Back to cluster</button></div></div>
    <div class="settings-layout"><div class="settings-main">
      <section class="panel settings-card"><div class="settings-card-title"><div class="settings-icon">⌘</div><div><h2>Kubeconfig discovery</h2><p>Choose where Orbita searches for Kubernetes configuration files.</p></div></div><form id="settings-form"><label class="field-label" for="search-path">Search path</label><div class="input-with-icon"><span>⌁</span><input id="search-path" value="${escapeHtml(settings.searchPath)}" placeholder="~/.kube" required></div><small class="field-help">A file or directory. Leave the default to use ~/.kube/config and KUBECONFIG.</small><div class="form-actions"><button type="button" class="button secondary" data-action="cancel-settings">Cancel</button><button type="button" class="button primary" data-action="save-settings">Save changes</button></div>${settingsSaved ? `<p class="inline-success" id="settings-success">✓ Settings saved and context discovery refreshed.</p>` : ""}</form></section>
      <section class="panel settings-card"><div class="settings-card-title"><div class="settings-icon lilac">⌑</div><div><h2>Saved kubeconfigs</h2><p>Configurations pasted into Orbita are stored locally in your app data.</p></div><button class="button secondary small-button" data-action="add-config">${icon("plus")} Add kubeconfig</button></div>
        ${settings.savedConfigs.length ? settings.savedConfigs.map((c: {id:string;name:string;yaml:string}) => `<div class="saved-config"><div class="saved-config-title"><div><strong>${escapeHtml(c.name)}</strong><span>Saved configuration</span></div><button class="text-button danger-text" data-action="remove-config" data-id="${escapeHtml(c.id)}">Remove</button></div><textarea data-config="${escapeHtml(c.id)}" aria-label="Kubeconfig YAML for ${escapeHtml(c.name)}">${escapeHtml(c.yaml)}</textarea><div class="saved-config-actions"><span>YAML configuration</span><button class="button secondary" data-action="save-config" data-id="${escapeHtml(c.id)}">Save kubeconfig</button></div></div>`).join("") : `<div class="empty-config"><span>⌘</span><strong>No saved kubeconfigs</strong><p>Add a pasted configuration to keep it available across sessions.</p></div>`}
      </section>
      <section class="panel settings-card"><div class="settings-card-title"><div class="settings-icon mint-icon">◐</div><div><h2>Appearance</h2><p>Make the workspace yours.</p></div></div><div class="appearance-row"><div><strong>Theme</strong><span>Choose a light or dark interface.</span></div><div class="segmented"><button data-theme="light" class="${settings.theme === "light" ? "selected" : ""}">☼ Light</button><button data-theme="dark" class="${settings.theme === "dark" ? "selected" : ""}">◐ Dark</button></div></div><div class="appearance-row"><div><strong>Density</strong><span>Adjust spacing in resource tables.</span></div><select id="settings-density" class="settings-select"><option value="cozy" ${settings.density === "cozy" ? "selected" : ""}>Cozy</option><option value="normal" ${settings.density === "normal" ? "selected" : ""}>Normal</option><option value="compact" ${settings.density === "compact" ? "selected" : ""}>Compact</option></select></div></section>
    </div><aside class="settings-aside"><section class="panel side-settings-card"><span class="settings-aside-icon">◉</span><h3>CLI tools</h3><p>Orbita uses local command-line tools when available.</p>${["kubectl", "Docker", "kind"].map(x => {
      const detected = cli[x.toLowerCase() as keyof typeof cli];
      return `<div class="tool-row"><span class="tool-status-dot ${detected ? "up" : ""}"></span><strong>${x}</strong><span>${cliChecking ? "Checking availability" : detected ? "Detected" : "Not detected"}</span></div><small class="tool-path">${escapeHtml(cliPaths[x.toLowerCase()] ?? (cliChecking ? "Checking availability" : "Executable not found on PATH"))}</small>`;
    }).join("")}</section><section class="panel help-card"><span>✧</span><strong>Need a hand?</strong><p>Install kubectl to connect Orbita to a Kubernetes cluster.</p><button data-view="about" class="subtle-button">About Orbita ${icon("arrow")}</button></section></aside></div></div>`;
}
function renderAbout(): string {
  return `<div class="page-content about-page"><div class="page-title-row"><div><div class="eyebrow">ORBITA <span>·</span> INFORMATION</div><h1>About ${escapeHtml(about.name)}</h1><p class="page-subtitle">A focused workspace for understanding your Kubernetes clusters.</p></div></div><section class="panel about-card"><div class="about-logo">${icon("cluster")}</div><span class="about-wordmark">${escapeHtml(about.name.toLowerCase())}</span><span class="about-version">VERSION ${escapeHtml(about.version)}</span><p>${escapeHtml(about.description)}</p><div class="about-meta"><div><span>AUTHOR</span><strong>${escapeHtml(about.author)}</strong></div>${about.email ? `<div><span>EMAIL</span><strong>${escapeHtml(about.email)}</strong></div>` : ""}<div><span>REPOSITORY</span><strong>${escapeHtml(about.repository)}</strong></div></div><button class="button primary" data-view="dashboard">${icon("chevron")} Back to cluster</button></section></div>`;
}

function renderDialog(): string {
  if (!dialog) return "";
  return `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div><div class="eyebrow">CLUSTER CONFIGURATION</div><h2 id="dialog-title">Add kubeconfig</h2><p>Paste a kubeconfig YAML document to add its contexts to Orbita.</p></div><button class="icon-button" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button></header><form id="add-config-form"><label class="field-label" for="new-config-name">Configuration name</label><input class="dialog-input" id="new-config-name" placeholder="My cluster" value="New cluster"><label class="field-label" for="new-config-yaml">Kubeconfig YAML</label><textarea id="new-config-yaml" placeholder="apiVersion: v1&#10;kind: Config&#10;contexts:&#10;  - name: my-context" required></textarea><p class="dialog-error" id="config-error" role="alert"></p><footer><button class="button secondary" type="button" data-action="close-dialog">Cancel</button><button type="button" class="button primary" data-action="validate-add-config">Validate &amp; add</button></footer></form></section></div>`;
}

function renderTerminal(): string {
  if (!terminalOpen) return "";
  const off = !cli.kubectl ? "disabled" : "";
  return `<div class="terminal-backdrop"><section class="panel terminal-panel ${!cli.kubectl ? "terminal-disabled" : ""} ${terminalExpanded ? "terminal-expanded" : ""}" role="dialog" aria-modal="true" aria-labelledby="terminal-title">
    <div class="panel-heading terminal-heading"><div><span class="terminal-icon">&gt;_</span><div><h3 id="terminal-title">Kubectl terminal</h3><p>Run commands against <strong>${escapeHtml(selectedContext)}</strong></p></div></div><div class="terminal-actions"><span class="terminal-online"><i></i>Context bound</span><button class="icon-button small" data-action="toggle-terminal" aria-label="${terminalExpanded ? "Collapse" : "Expand"} output" ${off}>⤢</button><button class="icon-button small" data-action="clear-output" aria-label="Clear output" ${off}>⌫</button><button class="icon-button small" data-action="clear-history" aria-label="Clear history" ${off}>⌁</button><button class="icon-button small" data-action="close-terminal" aria-label="Close terminal">${icon("close")}</button></div></div>
    <div class="terminal-body"><div class="terminal-command-pane"><div class="terminal-pane-title">COMMAND HISTORY <button data-action="clear-history" aria-label="Clear command history" ${off}>Clear</button></div><div class="command-history">${terminalHistory.length ? terminalHistory.map(h => `<button class="history-entry" data-command="${escapeHtml(h.command)}"><span>$</span> ${escapeHtml(h.command)}<small>${escapeHtml(h.status)}</small></button>`).join("") : `<div class="history-empty">Your recent commands will appear here.<br><code>kubectl get pods -A</code></div>`}</div><form id="terminal-form" class="terminal-form"><span>$</span><input id="terminal-input" value="${escapeHtml(terminalInput)}" placeholder="kubectl get pods" aria-label="Kubectl command" autocomplete="off" ${off}><button type="button" data-action="run-terminal" aria-label="Run command" ${off}>Run&nbsp; ↗</button></form></div>
      <div class="terminal-output-pane"><div class="terminal-pane-title">OUTPUT <span class="output-context">${escapeHtml(selectedContext)}</span></div><div class="terminal-output" id="terminal-output" role="log" aria-live="polite" aria-label="Terminal output">${terminalStatus !== null ? `${terminalOutput ? `<pre class="terminal-stdout">${highlightYaml(terminalOutput)}</pre>` : ""}${terminalStderr ? `<pre class="terminal-stderr">${escapeHtml(terminalStderr)}</pre>` : ""}<div class="terminal-exit ${terminalStatus === "0" ? "success" : "failure"}">Process exited with code ${escapeHtml(terminalStatus)}</div>` : `<div class="output-placeholder"><span>⌁</span><strong>Ready for your first command</strong><small>Output will appear here</small></div>`}</div></div></div>
    ${!cli.kubectl ? `<div class="terminal-overlay"><div class="terminal-overlay-card"><span>⌘</span><strong>kubectl not detected</strong><p>Install kubectl and restart Orbita to enable the terminal. All other cluster views remain available in demo mode.</p></div></div>` : ""}
  </section></div>`;
}

function renderLogs(): string {
  if (!logs) return "";
  const body = logs.state === "loading" ? "Loading logs…" : logs.state === "empty" ? "No log output was returned." : logs.body;
  return `<aside class="logs-drawer" role="dialog" aria-modal="false" aria-labelledby="logs-title"><header><h3 id="logs-title">${escapeHtml(logs.title)}</h3><button class="icon-button small" data-action="close-logs" aria-label="Close logs">${icon("close")}</button></header><pre class="logs-output ${logs.state === "error" ? "logs-error" : ""}" role="log" aria-live="polite" aria-label="Log output">${escapeHtml(body)}</pre></aside>`;
}

function render(): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.density = settings.density;
  root.innerHTML = `<div class="app-shell">${renderSidebar()}<main class="main-area">${renderHeader()}${view === "dashboard" ? renderDashboard() : view === "settings" ? renderSettings() : view === "about" ? renderAbout() : renderResourceTable(view)}${renderInspector()}${renderDialog()}${renderTerminal()}${renderLogs()}${renderStatusBar()}</main></div>`;
  for (const el of root.querySelectorAll<HTMLElement>(".command-history, .terminal-output")) el.scrollTop = el.scrollHeight;
}

function setView(next: string): void {
  if (next === "settings" || next === "about" || next === "dashboard" || definitions.some(d => d.key === next)) {
    view = next as View; inspector = null; search = ""; sort = { column: "Name", direction: 1 }; render();
    if (definitions.some(d => d.key === next) && !loaded.has(next as ResourceKey)) {
      if (bridged()) void loadRealResources(next as ResourceKey);
      else { loaded.add(next as ResourceKey); render(); }
    }
  }
}
function updateSnapshot(): void {
  snapshot = { ...demo };
  loaded = new Set(initialKeys);
  refreshTime = "Just now";
  notice = `Connected to ${selectedContext} · Showing deterministic demo data`;
}

async function loadRealResources(key: ResourceKey): Promise<void> {
  if (!bridged() || !selectedContext) return;
  loadingCollections.add(key);
  notice = `Loading ${getDef(key).label.toLowerCase()} from ${selectedContext}…`;
  render();
  try {
    const resources = await call<Resource[]>("get_resources", {
      kind: key,
      namespace: getDef(key).namespaced ? settings.namespace : "All namespaces",
    });
    snapshot[key] = resources;
    loaded.add(key);
    notice = `Connected to ${selectedContext} · Live cluster data`;
  } catch (error) {
    notice = `Could not load ${getDef(key).label.toLowerCase()} from ${selectedContext}: ${String(error)} · Showing demo data`;
  } finally {
    loadingCollections.delete(key);
    render();
  }
}

async function loadRealSnapshot(): Promise<void> {
  if (!bridged() || !selectedContext) return;
  snapshot = { ...demo };
  loaded.clear();
  const initial: ResourceKey[] = ["namespaces", "nodes", "pods", "deployments", "daemonsets", "statefulsets", "events"];
  initial.forEach(key => loadingCollections.add(key));
  notice = `Connecting to ${selectedContext}…`;
  render();
  const results = await Promise.allSettled(initial.map(key => call<Resource[]>("get_resources", {
    kind: key,
    namespace: key === "nodes" || key === "namespaces" ? "All namespaces" : settings.namespace,
  })));
  const errors: string[] = [];
  results.forEach((result, i) => {
    const key = initial[i];
    if (result.status === "fulfilled") {
      snapshot[key] = result.value;
      loaded.add(key);
    } else {
      errors.push(`${getDef(key).label}: ${String(result.reason)}`);
    }
    loadingCollections.delete(key);
  });
  refreshTime = "Just now";
  notice = errors.length
    ? `Some live collections were unavailable (${errors.join("; ")}). Showing demo data for those resources.`
    : `Connected to ${selectedContext} · Live cluster data`;
  render();
}

async function loadRealContexts(): Promise<void> {
  if (!bridged()) return;
  try {
    const result = await call<{ contexts: string[]; selectedContext: string }>("get_contexts");
    if (!result.contexts.length) {
      notice = "No Kubernetes contexts found · Showing deterministic demo data";
      render();
      return;
    }
    contextNames = [...result.contexts].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    snapshot = { ...demo };
    loaded.clear();
    selectedContext = result.contexts.includes(settings.selectedContext)
      ? settings.selectedContext
      : result.selectedContext || result.contexts[0];
    settings.selectedContext = selectedContext;
    await saveSettings();
    await loadRealSnapshot();
  } catch (error) {
    notice = `Kubernetes context discovery failed: ${String(error)} · Showing deterministic demo data`;
    render();
  }
}

async function refreshCurrentView(): Promise<void> {
  if (!bridged()) {
    updateSnapshot();
    render();
  } else if (view === "dashboard") {
    await loadRealSnapshot();
  } else if (definitions.some(d => d.key === view)) {
    await loadRealResources(view as ResourceKey);
  }
}

root.addEventListener("click", async event => {
  const target = event.target as HTMLElement;
  if (target.classList.contains("inspector-backdrop")) { inspector = null; render(); return; }
  if (target.classList.contains("dialog-backdrop")) { dialog = null; render(); return; }
  if (target.classList.contains("terminal-backdrop")) { closeTerminal(); return; }
  const btn = target.closest<HTMLElement>("[data-action], [data-view], [data-sort], [data-resource], [data-theme], [data-command]");
  if (!btn) return;
  if (btn.dataset.view) { setView(btn.dataset.view); return; }
  if (btn.dataset.action === "toggle-group") {
    const group = btn.dataset.group!;
    collapsed.has(group) ? collapsed.delete(group) : collapsed.add(group); render(); return;
  }
  if (btn.dataset.sort) {
    const next = btn.dataset.sort;
    sort = { column: next, direction: sort.column === next ? -sort.direction : 1 }; render(); return;
  }
  if (btn.dataset.resource) {
    const item = (snapshot[view as ResourceKey] ?? []).find(r => identity(r) === btn.dataset.resource);
    if (item) { inspector = item; render(); } return;
  }
  if (btn.dataset.theme) { settings.theme = btn.dataset.theme; saveSettings(); render(); return; }
  if (btn.dataset.command) {
    terminalInput = btn.dataset.command; render(); document.querySelector<HTMLInputElement>("#terminal-input")?.focus(); return;
  }
  switch (btn.dataset.action) {
    case "refresh": void refreshCurrentView(); break;
    case "toggle-theme": settings.theme = settings.theme === "dark" ? "light" : "dark"; saveSettings(); render(); break;
    case "toggle-terminal": terminalExpanded = !terminalExpanded; render(); break;
    case "clear-output": terminalOutput = ""; terminalStatus = null; render(); break;
    case "clear-history": terminalHistory = []; render(); break;
    case "add-config": dialog = "add-config"; render(); break;
    case "close-dialog": dialog = null; render(); break;
    case "close-inspector": inspector = null; render(); break;
    case "open-terminal": terminalOpen = true; render(); document.querySelector<HTMLElement>(cli.kubectl ? "#terminal-input" : "[data-action=close-terminal]")?.focus(); break;
    case "close-terminal": closeTerminal(); break;
    case "close-logs": closeLogs(); break;
    case "open-resource": {
      const item = (snapshot[view as ResourceKey] ?? []).find(r => identity(r) === btn.dataset.id);
      if (item) { inspector = item; render(); }
      break;
    }
    case "open-logs": {
      const item = (snapshot[view as ResourceKey] ?? []).find(r => identity(r) === btn.dataset.id);
      if (item) void openLogs(item, btn.dataset.logOpener ?? "");
      break;
    }
    case "open-logs-inspector": if (inspector) void openLogs(inspector, "inspector"); break;
    case "validate-add-config": void addKubeconfig(); break;
    case "save-settings": void saveSettingsForm(); break;
    case "run-terminal": void runTerminal(); break;
    case "dismiss-notice": notice = ""; render(); break;
    case "clear-search": search = ""; render(); break;
    case "cancel-settings": setView("dashboard"); break;
    case "copy-name":
      if (inspector) await navigator.clipboard?.writeText(inspector.metadata.name);
      break;
    case "copy-manifest":
      if (inspector) {
        await navigator.clipboard?.writeText(manifestYaml(inspector));
      }
      break;
    case "remove-config":
      settings.savedConfigs = settings.savedConfigs.filter((x: {id:string}) => x.id !== btn.dataset.id);
      syncDemoContexts();
      await saveSettings();
      render();
      await loadRealContexts();
      break;
    case "save-config": {
      const area = document.querySelector<HTMLTextAreaElement>(`textarea[data-config="${CSS.escape(btn.dataset.id ?? "")}"]`);
      if (area && validateKubeconfig(area.value)) {
        const entry = settings.savedConfigs.find((x: {id:string}) => x.id === btn.dataset.id);
        if (entry) {
          entry.yaml = area.value;
          syncDemoContexts();
          await saveSettings();
          notice = "Kubeconfig saved and validated.";
          render();
          await loadRealContexts();
        }
      } else if (area) {
        area.setCustomValidity("This document must contain at least one kubeconfig context."); area.reportValidity();
      }
      break;
    }
  }
});

root.addEventListener("input", event => {
  const el = event.target as HTMLInputElement;
  if (el.id === "search-input") {
    search = el.value;
    const start = el.selectionStart ?? search.length;
    render();
    const input = document.querySelector<HTMLInputElement>("#search-input");
    input?.focus(); input?.setSelectionRange(start, start);
  } else if (el.id === "terminal-input") terminalInput = el.value;
});
root.addEventListener("change", async event => {
  const el = event.target as HTMLSelectElement;
  if (el.id === "namespace-select") {
    settings.namespace = el.value;
    await saveSettings();
    if (view === "dashboard") void loadRealSnapshot();
    else if (definitions.some(d => d.key === view)) void loadRealResources(view as ResourceKey);
    else render();
  }
  if (el.id === "density-select" || el.id === "settings-density") { settings.density = el.value; await saveSettings(); render(); }
  if (el.id === "context-select") {
    selectedContext = el.value;
    settings.selectedContext = selectedContext;
    snapshot = { ...demo };
    loaded = new Set(bridged() ? [] : initialKeys);
    await saveSettings();
    if (bridged()) void loadRealSnapshot(); else { notice = `Connected to ${selectedContext} · Showing deterministic demo data`; render(); }
  }
});
document.addEventListener("keydown", event => {
  const target = event.target as HTMLElement;
  if (event.key === "Enter" && target.classList.contains("resource-row")) target.click();
  if (event.key === "Enter" && target.id === "terminal-input") {
    event.preventDefault();
    void runTerminal();
  }
  if (event.key === "Escape") {
    if (logs) closeLogs();
    else if (terminalOpen) closeTerminal();
    else if (dialog) { dialog = null; render(); }
    else if (inspector) { inspector = null; render(); }
  }
  if (event.key === "Tab" && target.id === "terminal-input" && (target as HTMLInputElement).value.trim() === "k") {
    event.preventDefault(); (target as HTMLInputElement).value = "kubectl "; terminalInput = "kubectl "; (target as HTMLInputElement).setSelectionRange(8, 8);
  }
});
async function saveSettingsForm(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#search-path");
  const path = input?.value.trim() ?? "";
  if (!path) {
    input?.setCustomValidity("Enter a kubeconfig search path.");
    input?.reportValidity();
    return;
  }
  settings.searchPath = path;
  settingsSaved = true;
  await saveSettings();
  render();
  await loadRealContexts();
}

async function addKubeconfig(): Promise<void> {
  const yaml = document.querySelector<HTMLTextAreaElement>("#new-config-yaml")?.value ?? "";
  const err = document.querySelector<HTMLElement>("#config-error");
  if (!validateKubeconfig(yaml)) {
    if (err) err.textContent = "This doesn't look like a valid kubeconfig. Include a contexts entry with at least one context name.";
    return;
  }
  const name = document.querySelector<HTMLInputElement>("#new-config-name")?.value.trim() || "Saved kubeconfig";
  const id = `config-${Date.now().toString(36)}`;
  settings.savedConfigs.push({ id, name, yaml });
  const newContexts = getKubeconfigContextNames(yaml);
  contextNames = [...new Set([...contextNames, ...newContexts])];
  if (newContexts.length) {
    selectedContext = newContexts[0];
    settings.selectedContext = selectedContext;
  }
  await saveSettings();
  dialog = null;
  notice = `Kubeconfig “${name}” added.`;
  render();
  await loadRealContexts();
}

function closeTerminal(): void {
  terminalOpen = false;
  render();
  document.querySelector<HTMLElement>('[data-action="open-terminal"]')?.focus();
}
function closeLogs(): void {
  const opener = logs?.opener ?? "";
  logs = null;
  render();
  if (opener) document.querySelector<HTMLElement>(`[data-log-opener="${CSS.escape(opener)}"]`)?.focus();
}
function demoLogs(r: Resource, key: ResourceKey): string {
  const lines = (n: string) => [`2026-10-03T08:59:01Z starting ${n}`, `2026-10-03T08:59:02Z ready to serve requests`, `2026-10-03T08:59:30Z healthy`].join("\n");
  if (key === "nodes") {
    const pods = snapshot.pods.filter(p => p.spec?.nodeName === r.metadata.name);
    return pods.length ? pods.slice(0, 20).map(p => `== ${p.metadata.namespace}/${p.metadata.name} ==\n${lines(p.metadata.name)}`).join("\n\n") : "";
  }
  return lines(r.metadata.name);
}
async function openLogs(r: Resource, opener: string): Promise<void> {
  const key = view as ResourceKey;
  const title = `Logs · ${r.kind} ${r.metadata.namespace ? `${r.metadata.namespace}/` : ""}${r.metadata.name}`;
  if (!logKinds.has(key)) {
    logs = { title, body: `Logs are not available for ${r.kind} resources. Open a Pod, workload or Node to view logs.`, state: "ready", opener };
    render();
    return;
  }
  logs = { title, body: "", state: "loading", opener };
  render();
  const current = logs;
  try {
    const text: string = bridged()
      ? await call<string>("get_logs", { kind: key, namespace: r.metadata.namespace ?? "", name: r.metadata.name, context: selectedContext })
      : demoLogs(r, key);
    if (logs !== current) return;
    logs = { ...current, body: text, state: text.trim() ? "ready" : "empty" };
  } catch (error) {
    if (logs !== current) return;
    logs = { ...current, body: `Could not load logs: ${String(error)}`, state: "error" };
  }
  render();
}

async function runTerminal(): Promise<void> {
  const command = terminalInput.trim();
  terminalStderr = "";
  try {
    const args = parseKubectlCommand(command);
    let result: { stdout?: string; stderr?: string; exitCode?: number };
    try {
      result = await call("run_kubectl", { arguments: args, context: selectedContext });
    } catch (error) {
      result = { stdout: "", stderr: `Could not execute kubectl: ${String(error)}`, exitCode: 1 };
    }
    terminalOutput = (result.stdout ?? "").slice(0, 200_000);
    terminalStderr = (result.stderr ?? "").slice(0, 200_000);
    terminalStatus = String(result.exitCode ?? 0);
  } catch (e) {
    terminalOutput = "";
    terminalStderr = e instanceof Error ? e.message : "Unable to parse command.";
    terminalStatus = "1";
  }
  terminalHistory.push({ command, output: terminalOutput || terminalStderr, status: terminalStatus ?? "1" });
  terminalHistory = terminalHistory.slice(-1000);
  terminalInput = "";
  render();
  document.querySelector<HTMLInputElement>("#terminal-input")?.focus();
}

async function loadCliTools(): Promise<void> {
  if (!bridged()) return;
  try {
    const result = await call<{ tools: Record<string, { available: boolean; path?: string }> }>("check_cli_tools");
    for (const key of ["kubectl", "docker", "kind"] as const) {
      cli[key] = Boolean(result.tools[key]?.available);
      if (result.tools[key]?.path) cliPaths[key] = result.tools[key].path!;
    }
  } catch {
    cli = { kubectl: false, docker: false, kind: false };
  }
  cliChecking = false;
  render();
}

async function loadAbout(): Promise<void> {
  try { about = { ...about, ...(await call<Partial<typeof about>>("get_about")) }; } catch { /* keep defaults */ }
  render();
}

async function loadPreferences(): Promise<void> {
  if (!bridged()) return;
  try {
    const saved = await call<Partial<typeof defaults>>("get_preferences");
    settings = { ...settings, ...saved };
    selectedContext = settings.selectedContext;
    saveSettingsToBrowser();
  } catch {
    notice = "Could not load saved preferences. Using the current local settings.";
  }
  render();
}
function saveSettingsToBrowser(): void {
  localStorage.setItem("orbita-preferences", JSON.stringify(settings));
}

if (isTauri()) clock.now = Date.now;
syncDemoContexts();
function handleMenu(id: string): void { setView(id === "open-settings" ? "settings" : "about"); }
render();
if (bridged()) {
  void (async () => {
    await loadPreferences();
    await loadCliTools();
    await loadAbout();
    await loadRealContexts();
  })();
  window.addEventListener("orbita-menu", event => handleMenu(String((event as CustomEvent).detail)));
  if (isTauri()) void listen<string>("orbita-menu", event => handleMenu(event.payload)).catch(() => undefined);
} else {
  cliChecking = false;
  render();
}
