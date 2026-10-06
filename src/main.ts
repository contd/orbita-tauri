/**
 * Application entry point and controller.
 *
 * Holds all mutable UI state, talks to the native (Tauri) host or a test bridge, loads Kubernetes
 * resources, and wires DOM events to state changes. Every change ends with `render`, which hands a
 * read-only view of the state to the renderer. Pure Kubernetes logic lives in `./kubernetes`; markup and
 * DOM access live in `./renderer`.
 * @module main
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  clock, demo, demoLogs, expandKubectlShortcut, getDef, getKubeconfigContextNames, identity, manifestYaml, parseKubectlCommand, validateKubeconfig, withOutputFormat,
  type OutputFormat, type Resource, type ResourceKey,
} from "./kubernetes";
import { packageInfo, type AboutInfo } from "./package-info";
import { closestTo, escapeSelector, getRoot, logKinds, mount, onDocument, query, targetOf, type RenderState, type View } from "./renderer";
import { isAppViewName, isResourceView } from "./views";

/**
 * Preference values used when nothing has been saved yet.
 * Also the shape of the persisted settings object (`theme`, `density`, kubeconfig `searchPath`, active `namespace`,
 * `selectedContext` and pasted `savedConfigs`).
 */
const defaults = { theme: "dark", density: "normal", searchPath: "~/.kube", namespace: "All namespaces", selectedContext: "test-context", savedConfigs: [] as { id: string; name: string; yaml: string }[] };
/**
 * Current user preferences, loaded from `localStorage` on start and later replaced by the native host's copy.
 * Falls back to the defaults when storage is empty or corrupt.
 */
let settings = (() => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem("orbita-preferences") ?? "{}") }; }
  catch { return { ...defaults }; }
})();
/** The page currently shown: the dashboard, settings, about, or a resource list. */
let view: View = "dashboard";
/** Free-text filter applied to the current resource table. Reset whenever the view changes. */
let search = "";
/** Active table sort: the column label and direction (`1` ascending, `-1` descending). */
let sort = { column: "Name", direction: 1 };
/** The resource whose inspector panel is open, or `null` when it is closed. */
let inspector: Resource | null = null;
/** Which modal dialog is open (only the add-kubeconfig dialog exists), or `null`. */
let dialog: "add-config" | null = null;
/** Names of sidebar navigation groups the user has folded. */
let collapsed = new Set<string>();
/** localStorage key remembering whether the sidebar is collapsed to icons. */
const SIDEBAR_KEY = "orbita-sidebar-collapsed";
/** True when the sidebar shows icons only; restored from the previous session. */
let sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
/** Which command-line tools were detected on this machine. Everything starts as missing until checked. */
const emptyCli: RenderState["cli"] = {
  kubectl: false,
  docker: false,
  kind: false,
  aws: false,
  bash: false,
  wsl: false,
  hostWindows: false,
};
let cli = { ...emptyCli };
/** True until the first tool detection finishes, so the UI can show "Checking availability". */
let cliChecking = true;
/** Resolved executable path for each detected tool, keyed by lower-case tool name. */
let cliPaths: Record<string, string> = {};
/** Whether the terminal panel fills the full height of the app (otherwise about two thirds). */
let terminalExpanded = false;
/** Width percentage of the command-history pane in the terminal body. */
let terminalSplit = 18;
/** Per-view resource table column widths in pixels, including each table's final actions column. */
let tableColumnWidths: Partial<Record<ResourceKey, number[]>> = {};
/** Output format applied to terminal commands; changing it re-runs the last command. */
let terminalFormat: OutputFormat = "text";
/** The last command that was run, re-run when the output format changes. Empty before any run. */
let lastCommand = "";
/** Text currently typed in the terminal command box. */
let terminalInput = "";
/** Standard output of the last terminal command. */
let terminalOutput = "";
/** Exit code of the last terminal command as a string, or `null` before any command has run. */
let terminalStatus: string | null = null;
/** Commands run in this session, newest last, with their output and exit status. Capped at 1000 entries. */
let terminalHistory: { command: string; output: string; status: string }[] = [];
/** Context names offered in demo mode, before any pasted kubeconfigs add more. */
const baseContexts = ["test-context", "staging-us-west", "local-kind"];
/** All Kubernetes context names shown in the context selector. */
let contextNames = [...new Set([...baseContexts, settings.selectedContext])];
/** The Kubernetes context all requests are made against. */
let selectedContext = settings.selectedContext;
/** Style metadata consumed by the context selector web component. */
type ContextStyle = RenderState["contextOptions"][number]["style"];
/** Shared style for generic contexts that do not match a special environment. */
const defaultContextStyle: ContextStyle = {
  accent: "#7aa2ff",
  border: "#425a78",
  background: "#141d29",
  text: "#d7e6ff",
};
/**
 * Context style by name pattern. This keeps environment hints (prod/staging/local) with the option data
 * instead of hardcoding them in the rendering component.
 */
function styleForContext(name: string): ContextStyle {
  if (/(^|[-_])(prod|production|live)([-_]|$)/i.test(name)) {
    return { accent: "#ff9b7a", border: "#6d4d46", background: "#2c1f21", text: "#ffd4c7" };
  }
  if (/(^|[-_])(stage|staging|qa|preprod)([-_]|$)/i.test(name)) {
    return { accent: "#ffd37a", border: "#665a3f", background: "#2b2418", text: "#ffe8b5" };
  }
  if (/(^|[-_])(local|kind|minikube|dev|test)([-_]|$)/i.test(name)) {
    return { accent: "#7fd6b5", border: "#3c6659", background: "#182a24", text: "#c6f7e4" };
  }
  return defaultContextStyle;
}
/** Full context options payload (value, label and per-option style metadata). */
function contextOptions(names: string[]): RenderState["contextOptions"] {
  return names.map(name => ({ value: name, label: name, style: styleForContext(name) }));
}
/**
 * In demo mode, rebuilds the context list from the built-in contexts plus the contexts of saved pasted kubeconfigs.
 * If the selected context disappeared, falls back to the first available one. Does nothing when a real bridge exists,
 * because the host reports the true contexts.
 */
function syncDemoContexts(): void {
  if (bridged()) return;
  contextNames = [...new Set([...baseContexts, ...settings.savedConfigs.flatMap((c: { yaml: string }) => getKubeconfigContextNames(c.yaml))])];
  if (!contextNames.includes(selectedContext)) { selectedContext = contextNames[0]; settings.selectedContext = selectedContext; }
}
/** Collections shown with counts in the sidebar on first load and fetched together for the dashboard. */
const initialKeys: ResourceKey[] = ["namespaces", "nodes", "pods", "deployments", "daemonsets", "statefulsets", "events"];
/** Collections whose data has been loaded; the sidebar only shows counts for these. */
let loaded = new Set<ResourceKey>(initialKeys);
/** Whether the kubectl terminal dialog is open. */
let terminalOpen = false;
/** Standard error of the last terminal command, shown separately from stdout. */
let terminalStderr = "";
/** State of the logs drawer, or `null` when closed. `opener` is the key of the control to refocus on close. */
let logs: { title: string; body: string; state: "loading" | "ready" | "error" | "empty"; opener: string } | null = null;
/** Application metadata for the About page and status bar, read from `package.json` at startup. */
const about: AboutInfo = packageInfo;

/** Signature of a command bridge: a command name plus JSON arguments, resolving to the host response. */
type Bridge = (command: string, args?: Record<string, unknown>) => Promise<any>;
/**
 * Returns the test bridge installed on `window.__ORBITA_BRIDGE__`, if any.
 * End-to-end tests install one so the app can run with no native host.
 */
const mockBridge = (): Bridge | undefined => (window as unknown as { __ORBITA_BRIDGE__?: Bridge }).__ORBITA_BRIDGE__;
/** True when commands can be sent anywhere: either a test bridge or the real Tauri host. False means demo mode. */
const bridged = (): boolean => Boolean(mockBridge()) || isTauri();
/**
 * Sends a command to the host. A test bridge takes priority over Tauri's `invoke`.
 * @typeParam T - Expected response type.
 * @param command - Name of the host command, such as `get_resources`.
 * @param args - JSON-serialisable arguments for the command.
 * @returns The host's response.
 */
function call<T = any>(command: string, args?: Record<string, unknown>): Promise<T> {
  const mock = mockBridge();
  return mock ? mock(command, args) : invoke<T>(command, args);
}
/** Collections with a fetch in flight; their tables show "Loading…". */
let loadingCollections = new Set<ResourceKey>();
/** Banner message shown on the dashboard and resource pages (connection state and errors). Empty hides it. */
let notice = `Connected to ${selectedContext} · Showing deterministic demo data`;
/** Human-readable time of the last refresh, displayed in headers and table footers. */
let refreshTime = "Just now";
/** True after the settings form was saved, to show the confirmation message. */
let settingsSaved = false;
/**
 * Resource data per collection. Starts as a copy of the demo data; real fetches overwrite individual
 * collections so unavailable ones keep showing demo data.
 */
let snapshot = { ...demo };

/** Empty resource collections used while switching contexts and waiting for fresh cluster data. */
function emptySnapshot(): Record<ResourceKey, Resource[]> {
  const next = {} as Record<ResourceKey, Resource[]>;
  for (const key of Object.keys(demo) as ResourceKey[]) next[key] = [];
  return next;
}

/**
 * Persists preferences to `localStorage` and, when a host exists, to the host's preference store.
 * A host failure is reported in the notice rather than thrown.
 * @returns Resolves when the save attempt has finished.
 */
function saveSettings(): Promise<void> {
  localStorage.setItem("orbita-preferences", JSON.stringify(settings));
  if (!bridged()) return Promise.resolve();
  return call("save_preferences", { preferences: settings }).then(() => undefined).catch(error => {
    notice = `Could not persist settings: ${String(error)}`;
    render();
  });
}

/**
 * Read-only view of the controller's variables handed to the renderer.
 * Getters are used so the renderer always sees current values even though the variables are reassigned.
 */
const state: RenderState = {
  get view() { return view; }, get search() { return search; }, get sort() { return sort; }, get inspector() { return inspector; },
  get dialog() { return dialog; }, get collapsed() { return collapsed; }, get sidebarCollapsed() { return sidebarCollapsed; }, get cli() { return cli; }, get cliChecking() { return cliChecking; },
  get cliPaths() { return cliPaths; }, get terminalOpen() { return terminalOpen; }, get terminalExpanded() { return terminalExpanded; }, get terminalSplit() { return terminalSplit; }, get terminalFormat() { return terminalFormat; },
  get tableColumnWidths() { return tableColumnWidths; },
  get terminalInput() { return terminalInput; }, get terminalOutput() { return terminalOutput; }, get terminalStderr() { return terminalStderr; },
  get terminalStatus() { return terminalStatus; }, get terminalHistory() { return terminalHistory; }, get contextNames() { return contextNames; },
  get contextOptions() { return contextOptions(contextNames); }, get selectedContext() { return selectedContext; }, get loaded() { return loaded; },
  get loadingCollections() { return loadingCollections; },
  get logs() { return logs; }, get about() { return about; }, get notice() { return notice; }, get refreshTime() { return refreshTime; },
  get settings() { return settings; }, get settingsSaved() { return settingsSaved; }, get snapshot() { return snapshot; }, get bridged() { return bridged(); },
};

/** Re-renders the whole interface from the current state. */
function render(): void {
  mount(state);
  fitTerminalInput();
}

const TERMINAL_SPLIT_MIN = 14;
const TERMINAL_SPLIT_MAX = 55;
let draggingTerminalSplit = false;
const TABLE_COLUMN_MIN = 24;
type TableColumnDrag = { key: ResourceKey; index: number; startX: number; startWidths: number[] };
let tableColumnDrag: TableColumnDrag | null = null;

/** Clamps the terminal split percentage into the supported range. */
function clampTerminalSplit(value: number): number {
  return Math.min(TERMINAL_SPLIT_MAX, Math.max(TERMINAL_SPLIT_MIN, value));
}

/** Applies the split as a CSS variable to the rendered terminal body. */
function paintTerminalSplit(): void {
  const body = query<HTMLElement>(".terminal-body");
  if (body) body.style.setProperty("--terminal-left", `${terminalSplit}%`);
}

/** Stops an active split drag session, if any. */
function stopTerminalSplitDrag(): void {
  draggingTerminalSplit = false;
  document.body.classList.remove("is-resizing-terminal");
}

/** Stops an active table-column resize session, if any. */
function stopTableColumnDrag(): void {
  tableColumnDrag = null;
  document.body.classList.remove("is-resizing-columns");
}

/** Collects visible header widths so resizing starts from exactly what the user sees. */
function tableHeaderWidths(table: HTMLTableElement): number[] {
  return [...table.querySelectorAll<HTMLTableCellElement>("thead th")].map(cell => cell.getBoundingClientRect().width);
}

/** Saved widths are reused when shape-compatible; otherwise current rendered widths are used. */
function startColumnWidths(key: ResourceKey, table: HTMLTableElement): number[] {
  const headerCount = table.querySelectorAll("thead th").length;
  const saved = tableColumnWidths[key] ?? [];
  const completeSaved = saved.length === headerCount && saved.every(width => Number.isFinite(width) && width > 0);
  if (completeSaved) return saved.map(width => Math.round(width));
  return tableHeaderWidths(table).map(width => Math.round(width));
}

/** True when the index points to the last column (no right-side neighbor to shrink). */
function isLastColumn(widths: number[], index: number): boolean {
  return index >= widths.length - 1;
}

/** Computes resized widths for one drag step while keeping every column above a minimum width. */
function resizeWidths(widths: number[], index: number, delta: number): number[] {
  const next = [...widths];
  if (isLastColumn(next, index)) {
    next[index] = Math.max(TABLE_COLUMN_MIN, next[index] + delta);
    return next;
  }
  const leftStart = next[index];
  const rightStart = next[index + 1];
  let applied = delta;
  let left = leftStart + applied;
  let right = rightStart - applied;
  if (left < TABLE_COLUMN_MIN) {
    applied = TABLE_COLUMN_MIN - leftStart;
    left = TABLE_COLUMN_MIN;
    right = rightStart - applied;
  }
  if (right < TABLE_COLUMN_MIN) {
    applied = rightStart - TABLE_COLUMN_MIN;
    right = TABLE_COLUMN_MIN;
    left = leftStart + applied;
  }
  next[index] = left;
  next[index + 1] = right;
  return next;
}

/** Applies the current column widths directly to the rendered table for smooth dragging. */
function paintTableColumnWidths(key: ResourceKey, widths: number[]): void {
  const table = query<HTMLTableElement>(`.resource-table-grid[data-resource-key="${escapeSelector(key)}"]`);
  if (!table) return;
  const total = widths.reduce((sum, width) => sum + (Number.isFinite(width) ? width : 0), 0);
  if (total > 0) table.style.width = `${Math.round(total)}px`;
  const cols = [...table.querySelectorAll<HTMLTableColElement>("colgroup col")];
  cols.forEach((col, index) => {
    const width = widths[index];
    col.style.width = Number.isFinite(width) && width > 0 ? `${Math.round(width)}px` : "";
  });
  const handles = [...table.querySelectorAll<HTMLElement>(".table-col-resizer")];
  handles.forEach((handle, index) => {
    const width = widths[index];
    if (Number.isFinite(width) && width > 0) handle.setAttribute("aria-valuenow", String(Math.round(width)));
  });
}

/** Updates one column width (and maybe its neighbor) then repaints the table without a full render. */
function applyColumnDelta(key: ResourceKey, index: number, startWidths: number[], delta: number): void {
  const next = resizeWidths(startWidths, index, delta).map(width => Math.round(width));
  tableColumnWidths[key] = next;
  paintTableColumnWidths(key, next);
}

/** Most lines the command box may show before it scrolls. */
const TERMINAL_INPUT_MAX_LINES = 2;

/**
 * Sizes the command box to its content: one line normally, two once the text wraps, never more.
 * Beyond two lines the box scrolls instead of growing.
 */
function fitTerminalInput(): void {
  const box = query<HTMLTextAreaElement>("#terminal-input");
  if (!box) return;
  box.style.height = "auto";
  const line = parseFloat(getComputedStyle(box).lineHeight) || box.clientHeight;
  const chrome = box.offsetHeight - box.clientHeight;
  const lines = Math.min(TERMINAL_INPUT_MAX_LINES, Math.max(1, Math.round(box.scrollHeight / line)));
  box.style.height = `${lines * line + chrome}px`;
}

/**
 * Navigates to a page. Closes the inspector, clears search and sort, and lazily loads the collection
 * the first time a resource view is visited. Unknown names are ignored.
 * @param next - `"dashboard"`, `"settings"`, `"about"` or a resource key.
 */
function setView(next: string): void {
  if (isAppViewName(next)) {
    view = next; inspector = null; search = ""; sort = { column: "Name", direction: 1 }; render();
    if (isResourceView(next) && !loaded.has(next)) {
      if (bridged()) void loadRealResources(next);
      else { loaded.add(next); render(); }
    }
  }
}
/** Resets all data to the demo fixtures and the default banner (demo-mode refresh). */
function updateSnapshot(): void {
  snapshot = { ...demo };
  loaded = new Set(initialKeys);
  refreshTime = "Just now";
  notice = `Connected to ${selectedContext} · Showing deterministic demo data`;
}

/**
 * Fetches one collection from the selected context and stores it in `snapshot`.
 * Failures are shown in the notice and the demo data for that collection is kept.
 * @param key - Collection to fetch.
 */
async function loadRealResources(key: ResourceKey): Promise<void> {
  if (!bridged() || !selectedContext) return;
  loadingCollections.add(key);
  snapshot[key] = [];
  notice = `Loading ${getDef(key).label.toLowerCase()} from ${selectedContext}…`;
  render();
  try {
    const resources = await call<Resource[]>("get_resources", {
      kind: key,
      namespace: getDef(key).namespaced ? settings.namespace : "All namespaces",
    });
    snapshot[key] = resources;
    if (key === "nodes" || key === "pods") {
      try {
        const metrics = await call<Resource[]>("get_resource_metrics", {
          kind: key,
          namespace: key === "pods" ? settings.namespace : "All namespaces",
        });
        if (key === "nodes") mergeNodeMetrics(metrics);
        else mergePodMetrics(metrics);
      } catch (error) {
        notice = `Connected to ${selectedContext} · Live cluster data · ${metricsErrorLabel(key)} unavailable (${String(error)})`;
      }
    }
    loaded.add(key);
    if (!notice.includes("unavailable")) {
      notice = `Connected to ${selectedContext} · Live cluster data`;
    }
  } catch (error) {
    snapshot[key] = demo[key];
    loaded.add(key);
    notice = `Could not load ${getDef(key).label.toLowerCase()} from ${selectedContext}: ${String(error)} · Showing demo data`;
  } finally {
    loadingCollections.delete(key);
    render();
  }
}

/** Human-friendly name for node/pod metrics fetch errors. */
function metricsErrorLabel(kind: "nodes" | "pods"): string {
  return kind === "nodes" ? "Node metrics" : "Pod metrics";
}

/** Merges node metrics-server usage into the current node snapshot by resource name. */
function mergeNodeMetrics(metrics: Resource[]): void {
  const byName = new Map(metrics.map(item => [item.metadata?.name ?? "", item]));
  snapshot.nodes = snapshot.nodes.map(node => {
    const metric = byName.get(node.metadata.name);
    if (!metric?.usage) return node;
    return {
      ...node,
      metrics: { ...(node.metrics ?? {}), usage: metric.usage },
    };
  });
}

/** Merges pod metrics-server container usage into the current pod snapshot by namespace/name identity. */
function mergePodMetrics(metrics: Resource[]): void {
  const byIdentity = new Map(metrics.map(item => [`${item.metadata?.namespace ?? ""}/${item.metadata?.name ?? ""}`, item]));
  snapshot.pods = snapshot.pods.map(pod => {
    const metric = byIdentity.get(`${pod.metadata.namespace ?? ""}/${pod.metadata.name}`);
    if (!Array.isArray(metric?.containers)) return pod;
    return {
      ...pod,
      metrics: { ...(pod.metrics ?? {}), containers: metric.containers },
    };
  });
}

/**
 * Fetches the dashboard collections for the selected context in parallel.
 * Collections that fail keep their demo data and are listed in the notice.
 */
async function loadRealSnapshot(): Promise<void> {
  if (!bridged() || !selectedContext) return;
  snapshot = emptySnapshot();
  loaded.clear();
  const initial: ResourceKey[] = ["namespaces", "nodes", "pods", "deployments", "daemonsets", "statefulsets", "events"];
  loadingCollections = new Set(initial);
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
      snapshot[key] = demo[key];
      loaded.add(key);
      errors.push(`${getDef(key).label}: ${String(result.reason)}`);
    }
    loadingCollections.delete(key);
  });
  const metricFetches: Array<{ kind: "nodes" | "pods"; promise: Promise<Resource[]> }> = [];
  if (loaded.has("nodes")) {
    metricFetches.push({
      kind: "nodes",
      promise: call<Resource[]>("get_resource_metrics", { kind: "nodes", namespace: "All namespaces" }),
    });
  }
  if (loaded.has("pods")) {
    metricFetches.push({
      kind: "pods",
      promise: call<Resource[]>("get_resource_metrics", { kind: "pods", namespace: settings.namespace }),
    });
  }
  const metricErrors: string[] = [];
  const metricResults = await Promise.allSettled(metricFetches.map(fetch => fetch.promise));
  metricResults.forEach((result, index) => {
    const kind = metricFetches[index].kind;
    if (result.status === "fulfilled") {
      if (kind === "nodes") mergeNodeMetrics(result.value);
      else mergePodMetrics(result.value);
      return;
    }
    metricErrors.push(`${metricsErrorLabel(kind)}: ${String(result.reason)}`);
  });
  refreshTime = "Just now";
  const baseNotice = errors.length
    ? `Some live collections were unavailable (${errors.join("; ")}). Showing demo data for those resources.`
    : `Connected to ${selectedContext} · Live cluster data`;
  notice = metricErrors.length ? `${baseNotice} Metrics summary unavailable (${metricErrors.join("; ")}).` : baseNotice;
  render();
}

/**
 * Asks the host for available Kubernetes contexts, picks the selected one (the saved choice if still present),
 * persists it and loads the dashboard data. Discovery errors fall back to demo data with an explanatory notice.
 */
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
    snapshot = emptySnapshot();
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

/**
 * Reloads data for the current page: resets demo data in demo mode, otherwise refetches the dashboard
 * collections or the one collection being viewed.
 */
async function refreshCurrentView(): Promise<void> {
  if (!bridged()) {
    updateSnapshot();
    render();
  } else if (view === "dashboard") {
    await loadRealSnapshot();
  } else if (isResourceView(view)) {
    await loadRealResources(view);
  }
}

/**
 * Delegated click handler for the whole app. Resolves the nearest element carrying a `data-*` hook
 * (`data-view`, `data-sort`, `data-resource`, `data-theme`, `data-command` or `data-action`) and runs the
 * matching state change. Clicks on modal backdrops close that modal.
 */
getRoot().addEventListener("click", async event => {
  const target = targetOf<HTMLElement>(event);
  if (target.classList.contains("inspector-backdrop")) { inspector = null; render(); return; }
  if (target.classList.contains("dialog-backdrop")) { dialog = null; render(); return; }
  const btn = closestTo(target, "[data-action], [data-view], [data-sort], [data-resource], [data-theme], [data-command]");
  if (!btn) return;
  if (btn.dataset.view) { setView(btn.dataset.view); return; }
  if (btn.dataset.action === "toggle-sidebar") {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    render(); return;
  }
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
    terminalInput = btn.dataset.command; render(); query<HTMLTextAreaElement>("#terminal-input")?.focus(); return;
  }
  switch (btn.dataset.action) {
    case "refresh": void refreshCurrentView(); break;
    case "toggle-theme": settings.theme = settings.theme === "dark" ? "light" : "dark"; saveSettings(); render(); break;
    case "toggle-terminal": terminalExpanded = !terminalExpanded; render(); break;
    case "toggle-format":
      terminalFormat = terminalFormat === "text" ? "json" : "text";
      render();
      if (lastCommand) void runTerminal(lastCommand, true);
      break;
    case "clear-output": terminalOutput = ""; terminalStatus = null; render(); break;
    case "clear-history": terminalHistory = []; render(); break;
    case "add-config": dialog = "add-config"; render(); break;
    case "close-dialog": dialog = null; render(); break;
    case "close-inspector": inspector = null; render(); break;
    case "open-terminal": terminalOpen = true; render(); query<HTMLElement>(cli.kubectl ? "#terminal-input" : "[data-action=close-terminal]")?.focus(); break;
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
      const area = query<HTMLTextAreaElement>(`textarea[data-config="${escapeSelector(btn.dataset.id ?? "")}"]`);
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

/**
 * Starts dragging the divider between command history and output panes.
 * The body is updated live via a CSS variable; a full render is not needed while dragging.
 */
getRoot().addEventListener("pointerdown", event => {
  const target = targetOf<HTMLElement>(event);
  const handle = closestTo<HTMLElement>(target, ".table-col-resizer");
  if (!handle) return;
  const key = handle.dataset.resourceKey;
  const index = Number(handle.dataset.columnIndex);
  if (!key || !isResourceView(key) || !Number.isInteger(index)) return;
  const table = handle.closest<HTMLTableElement>("table.resource-table-grid");
  if (!table) return;
  const widths = startColumnWidths(key, table);
  if (!widths.length || index < 0 || index >= widths.length) return;
  tableColumnDrag = { key, index, startX: event.clientX, startWidths: widths };
  tableColumnWidths[key] = [...widths];
  document.body.classList.add("is-resizing-columns");
  event.preventDefault();
});

/**
 * Starts dragging the divider between command history and output panes.
 * The body is updated live via a CSS variable; a full render is not needed while dragging.
 */
getRoot().addEventListener("pointerdown", event => {
  const target = targetOf<HTMLElement>(event);
  if (!closestTo(target, ".terminal-splitter")) return;
  if (!terminalOpen || !cli.kubectl) return;
  const body = query<HTMLElement>(".terminal-body");
  if (!body) return;
  const rect = body.getBoundingClientRect();
  if (rect.width <= 0) return;
  draggingTerminalSplit = true;
  document.body.classList.add("is-resizing-terminal");
  event.preventDefault();
  const pointer = event as PointerEvent;
  const next = clampTerminalSplit(((pointer.clientX - rect.left) / rect.width) * 100);
  if (next !== terminalSplit) terminalSplit = next;
  paintTerminalSplit();
});

/** While resizing a table column, applies the new widths from the current pointer x-position. */
onDocument("pointermove", event => {
  if (!tableColumnDrag) return;
  const delta = event.clientX - tableColumnDrag.startX;
  applyColumnDelta(tableColumnDrag.key, tableColumnDrag.index, tableColumnDrag.startWidths, delta);
});

/** While dragging the divider, updates the split from the current pointer x-position. */
onDocument("pointermove", event => {
  if (!draggingTerminalSplit || !terminalOpen) return;
  const body = query<HTMLElement>(".terminal-body");
  if (!body) return;
  const rect = body.getBoundingClientRect();
  if (rect.width <= 0) return;
  const next = clampTerminalSplit(((event.clientX - rect.left) / rect.width) * 100);
  if (next === terminalSplit) return;
  terminalSplit = next;
  paintTerminalSplit();
});

/** Ends terminal divider dragging on pointer release or cancellation. */
onDocument("pointerup", () => {
  if (tableColumnDrag) {
    stopTableColumnDrag();
    render();
  }
  if (draggingTerminalSplit) stopTerminalSplitDrag();
});
onDocument("pointercancel", () => {
  if (tableColumnDrag) {
    stopTableColumnDrag();
    render();
  }
  if (draggingTerminalSplit) stopTerminalSplitDrag();
});

/**
 * Delegated input handler. Typing in the search box filters the table and restores the caret after the
 * re-render; typing in the terminal box only records the text.
 */
getRoot().addEventListener("input", event => {
  const el = targetOf<HTMLInputElement>(event);
  if (el.id === "search-input") {
    search = el.value;
    const start = el.selectionStart ?? search.length;
    render();
    const input = query<HTMLInputElement>("#search-input");
    input?.focus(); input?.setSelectionRange(start, start);
  } else if (el.id === "terminal-input") {
    // A command is a single logical line; Enter runs it, so pasted line breaks become spaces.
    if (/[\r\n]/.test(el.value)) el.value = el.value.replace(/\s*[\r\n]+\s*/g, " ");
    // Shortcuts apply only while typing forward, so backspacing "kubectl " down to "kub" is not re-expanded.
    const typing = !String((event as InputEvent).inputType ?? "").startsWith("delete");
    const expanded = typing ? expandKubectlShortcut(el.value) : el.value;
    if (expanded !== el.value) { el.value = expanded; el.setSelectionRange(expanded.length, expanded.length); }
    terminalInput = el.value;
    fitTerminalInput();
  }
});
/**
 * Delegated change handler for the selects: namespace (reloads data), density, and context
 * (resets data and loads the new context).
 */
getRoot().addEventListener("change", async event => {
  const el = targetOf<HTMLSelectElement>(event);
  if (el.id === "namespace-select") {
    settings.namespace = el.value;
    await saveSettings();
    if (view === "dashboard") void loadRealSnapshot();
    else if (isResourceView(view)) void loadRealResources(view);
    else render();
  }
  if (el.id === "density-select" || el.id === "settings-density") { settings.density = el.value; await saveSettings(); render(); }
  if (el.id === "context-select") {
    selectedContext = el.value;
    settings.selectedContext = selectedContext;
    snapshot = bridged() ? emptySnapshot() : { ...demo };
    loaded = new Set(bridged() ? [] : initialKeys);
    await saveSettings();
    if (bridged()) {
      notice = `Connecting to ${selectedContext}…`;
      render();
      void loadRealSnapshot();
    } else {
      notice = `Connected to ${selectedContext} · Showing deterministic demo data`;
      render();
    }
  }
});
/**
 * Global keyboard shortcuts: Enter opens a focused table row or runs the terminal command, Arrow keys resize
 * a focused table-column handle or terminal pane splitter, Escape closes the top-most overlay (logs, terminal, dialog,
 * inspector), and Tab expands `k` to `kubectl ` in the terminal box.
 */
onDocument("keydown", event => {
  const target = targetOf<HTMLElement>(event);
  if (target.classList.contains("table-col-resizer") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    const key = target.dataset.resourceKey;
    const index = Number(target.dataset.columnIndex);
    if (!key || !isResourceView(key) || !Number.isInteger(index)) return;
    const table = target.closest<HTMLTableElement>("table.resource-table-grid");
    const baseline = table ? startColumnWidths(key, table) : (tableColumnWidths[key] ?? []);
    if (!baseline.length || index < 0 || index >= baseline.length) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 12 : -12;
    const next = resizeWidths(baseline, index, delta).map(width => Math.round(width));
    tableColumnWidths[key] = next;
    render();
    query<HTMLElement>(`.table-col-resizer[data-resource-key="${escapeSelector(key)}"][data-column-index="${index}"]`)?.focus();
    return;
  }
  if (event.key === "Enter" && target.classList.contains("resource-row")) target.click();
  if (event.key === "Enter" && target.id === "terminal-input") {
    event.preventDefault();
    void runTerminal();
  }
  if (target.classList.contains("terminal-splitter") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    terminalSplit = clampTerminalSplit(terminalSplit + (event.key === "ArrowRight" ? 2 : -2));
    render();
  }
  if (event.key === "Escape") {
    if (logs) closeLogs();
    else if (terminalOpen) return; // the terminal closes only from its close button
    else if (dialog) { dialog = null; render(); }
    else if (inspector) { inspector = null; render(); }
  }
  if (event.key === "Tab" && target.id === "terminal-input" && (target as HTMLTextAreaElement).value.trim() === "k") {
    event.preventDefault(); (target as HTMLTextAreaElement).value = "kubectl "; terminalInput = "kubectl "; (target as HTMLTextAreaElement).setSelectionRange(8, 8);
  }
});
/**
 * Validates and saves the settings form. Requires a non-empty search path, then reruns context discovery
 * so the new path takes effect.
 */
async function saveSettingsForm(): Promise<void> {
  const input = query<HTMLInputElement>("#search-path");
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

/**
 * Validates the pasted kubeconfig from the add dialog, stores it, selects its first context, closes the dialog
 * and reloads contexts. Shows an inline error when the YAML has no contexts.
 */
async function addKubeconfig(): Promise<void> {
  const yaml = query<HTMLTextAreaElement>("#new-config-yaml")?.value ?? "";
  const err = query<HTMLElement>("#config-error");
  if (!validateKubeconfig(yaml)) {
    if (err) err.textContent = "This doesn't look like a valid kubeconfig. Include a contexts entry with at least one context name.";
    return;
  }
  const name = query<HTMLInputElement>("#new-config-name")?.value.trim() || "Saved kubeconfig";
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

/** Closes the terminal dialog and returns focus to the control that opens it. */
function closeTerminal(): void {
  stopTerminalSplitDrag();
  terminalOpen = false;
  render();
  query<HTMLElement>('[data-action="open-terminal"]')?.focus();
}
/** Closes the logs drawer and returns focus to the control that opened it. */
function closeLogs(): void {
  const opener = logs?.opener ?? "";
  logs = null;
  render();
  if (opener) query<HTMLElement>(`[data-log-opener="${escapeSelector(opener)}"]`)?.focus();
}
/**
 * Opens the logs drawer for a resource and fills it with log text from the host (or demo text).
 * Kinds without logs get an explanatory message. If the drawer is closed or reopened while loading, the late
 * result is discarded.
 * @param r - Resource to show logs for.
 * @param opener - Key of the control that opened the drawer, used to restore focus on close.
 */
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
      : demoLogs(r, key, snapshot.pods);
    if (logs !== current) return;
    logs = { ...current, body: text, state: text.trim() ? "ready" : "empty" };
  } catch (error) {
    if (logs !== current) return;
    logs = { ...current, body: `Could not load logs: ${String(error)}`, state: "error" };
  }
  render();
}

/**
 * Runs a command through the host's kubectl bridge using the selected output format. The command is parsed and
 * validated first; parse errors, host failures and non-zero exits are all shown in the output pane.
 * Output is truncated to 200,000 characters per stream.
 * @param command - Command text; defaults to what is typed in the command box.
 * @param rerun - True when repeating the last command after a format change: the box keeps its text and
 * history gets no new entry.
 */
async function runTerminal(command: string = terminalInput.trim(), rerun = false): Promise<void> {
  terminalStderr = "";
  try {
    const args = withOutputFormat(parseKubectlCommand(command), terminalFormat);
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
  lastCommand = command;
  if (!rerun) {
    terminalHistory.push({ command, output: terminalOutput || terminalStderr, status: terminalStatus ?? "1" });
    terminalHistory = terminalHistory.slice(-1000);
    terminalInput = "";
  }
  render();
  query<HTMLTextAreaElement>("#terminal-input")?.focus();
}

/** Detects CLI tools through the host and records their availability and executable paths. */
async function loadCliTools(): Promise<void> {
  if (!bridged()) return;
  try {
    const result = await call<{
      host?: { os?: string; isWindows?: boolean };
      tools: Record<string, { available: boolean; path?: string }>;
    }>("check_cli_tools");
    const hostWindows = Boolean(result.host?.isWindows || result.host?.os === "windows");
    cli = { ...emptyCli, hostWindows };
    cliPaths = {};
    for (const key of ["kubectl", "docker", "kind", "aws", "bash", "wsl"] as const) {
      cli[key] = Boolean(result.tools[key]?.available);
      if (result.tools[key]?.path) cliPaths[key] = result.tools[key].path!;
    }
  } catch {
    cli = { ...emptyCli };
  }
  cliChecking = false;
  render();
}

/** Replaces local settings with those stored by the host, if available. */
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
/** Mirrors the settings into `localStorage` so they survive reloads in the browser. */
function saveSettingsToBrowser(): void {
  localStorage.setItem("orbita-preferences", JSON.stringify(settings));
}

// Startup: use the real clock only inside Tauri so demo screens stay deterministic.
if (isTauri()) clock.now = Date.now;
syncDemoContexts();
/**
 * Handles a native menu action by showing Settings or About.
 * @param id - Menu item id; `"open-settings"` opens Settings, anything else opens About.
 */
function handleMenu(id: string): void { setView(id === "open-settings" ? "settings" : "about"); }
// Draw immediately with demo data, then replace it with live data once the host answers.
render();
if (bridged()) {
  void (async () => {
    await loadPreferences();
    await loadCliTools();
    await loadRealContexts();
  })();
  // Native menu events arrive via Tauri; tests dispatch the same event on `window`.
  window.addEventListener("orbita-menu", event => handleMenu(String((event as CustomEvent).detail)));
  if (isTauri()) void listen<string>("orbita-menu", event => handleMenu(event.payload)).catch(() => undefined);
} else {
  cliChecking = false;
  render();
}
