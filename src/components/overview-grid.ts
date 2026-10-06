import { ageDate, escapeHtml, namespace } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

type WorkloadSummary = {
  label: string;
  total: number;
  healthy: number;
  glyph: string;
  view: "deployments" | "statefulsets" | "daemonsets";
};

/** Clamps a readiness ratio to a safe 0-100 percentage. */
function ratio(ready: number, total: number): number {
  return total ? Math.max(0, Math.min(100, (ready / total) * 100)) : 0;
}

function workloadSummaries(s: RenderState): WorkloadSummary[] {
  return [
    {
      label: "Deployments",
      total: s.snapshot.deployments.length,
      healthy: s.snapshot.deployments.filter(resource => (resource.status?.readyReplicas ?? 0) >= (resource.spec?.replicas ?? 0)).length,
      glyph: "▥",
      view: "deployments",
    },
    {
      label: "StatefulSets",
      total: s.snapshot.statefulsets.length,
      healthy: s.snapshot.statefulsets.filter(resource => (resource.status?.readyReplicas ?? 0) >= (resource.spec?.replicas ?? 0)).length,
      glyph: "▣",
      view: "statefulsets",
    },
    {
      label: "DaemonSets",
      total: s.snapshot.daemonsets.length,
      healthy: s.snapshot.daemonsets.filter(resource => (resource.status?.numberReady ?? 0) >= (resource.status?.desiredNumberScheduled ?? 0)).length,
      glyph: "⠿",
      view: "daemonsets",
    },
  ];
}

function renderWorkloadRow(summary: WorkloadSummary): string {
  const allHealthy = summary.healthy === summary.total;
  return `<button type="button" class="workload-row workload-link" data-view="${summary.view}" aria-label="Open ${summary.label}">
    <span class="workload-glyph">${summary.glyph}</span>
    <span class="workload-name">${summary.label}</span>
    <div class="workload-bar"><span style="width:${ratio(summary.healthy, summary.total)}%"></span></div>
    <span class="workload-count">${summary.healthy}/${summary.total} ready</span>
    <span class="workload-check ${allHealthy ? "" : "partial"}">${allHealthy ? "✓" : "!"}</span>
  </button>`;
}

function podRestartCount(s: RenderState): number {
  return s.snapshot.pods.reduce((total, pod) => {
    const statuses = Array.isArray(pod.status?.containerStatuses) ? pod.status?.containerStatuses : [];
    return total + statuses.reduce((podTotal: number, status: Record<string, unknown>) => podTotal + Number(status.restartCount ?? 0), 0);
  }, 0);
}

function renderEvents(s: RenderState): string {
  const recentEvents = [...s.snapshot.events]
    .sort((a, b) => Date.parse(b.lastTimestamp ?? "") - Date.parse(a.lastTimestamp ?? ""))
    .slice(0, 4);

  return recentEvents
    .map(event => `<div class="event-row">
      <span class="event-marker ${event.type === "Warning" ? "warn" : ""}">${event.type === "Warning" ? "!" : "✓"}</span>
      <div class="event-copy">
        <strong>${escapeHtml(event.reason)} <span>${escapeHtml(event.involvedObject?.name)}</span></strong>
        <p>${escapeHtml(event.message)}</p>
        <small>${escapeHtml(namespace(event))} · ${escapeHtml(ageDate(event.lastTimestamp ?? ""))}</small>
      </div>
      <span class="event-count">${event.count && event.count > 1 ? `×${event.count}` : ""}</span>
    </div>`)
    .join("");
}

/** Reusable activity overview section with workload health and recent events. */
export function renderOverviewGrid(s: RenderState): string {
  const pods = s.snapshot.pods;
  const runningPods = pods.filter(pod => pod.status?.phase === "Running").length;
  const pendingPods = pods.filter(pod => pod.status?.phase === "Pending").length;
  const summaries = workloadSummaries(s);

  return `<div class="section-header">
    <div><h2>Cluster activity</h2><p>A quick look at your resources and recent activity.</p></div>
    <div class="dashboard-controls"><span class="last-updated">Updated ${escapeHtml(s.refreshTime)}</span></div>
  </div>
  <div class="overview-grid">
    <section class="panel resource-overview">
      <div class="panel-heading">
        <div><h3>Workload health</h3><p>Resource readiness by type</p></div>
      </div>
      ${summaries.map(renderWorkloadRow).join("")}
      <div class="panel-divider"></div>
      <button type="button" class="mini-stats mini-stats-link" data-view="pods" aria-label="Open Pods">
        <div><span class="mini-label">TOTAL PODS</span><strong>${pods.length}</strong></div>
        <div><span class="mini-label">RUNNING</span><strong class="text-green">${runningPods}</strong></div>
        <div><span class="mini-label">PENDING</span><strong class="text-amber">${pendingPods}</strong></div>
        <div><span class="mini-label">RESTARTS</span><strong>${podRestartCount(s)}</strong></div>
      </button>
    </section>
    <section class="panel events-panel">
      <div class="panel-heading">
        <div><h3>Recent events</h3><p>Latest activity across the cluster</p></div>
        <button class="subtle-button" data-view="events">All events ${icon("arrow")}</button>
      </div>
      <div class="events-list">${renderEvents(s)}</div>
    </section>
  </div>`;
}

defineComponent("orbita-overview-grid", renderOverviewGrid);
