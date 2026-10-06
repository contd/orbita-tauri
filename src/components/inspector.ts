import { age, escapeHtml, getDef, highlightYaml, identity, manifestYaml, rowStatus, statusTone, type ResourceKey } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";
import { logKinds } from "./types";

/** Returns the icon of the active resource view, with a generic fallback. */
function inspectorIcon(s: RenderState): string {
  return getDef(s.view as ResourceKey)?.icon ?? "◉";
}

/** Renders up to eight labels and, if needed, a compact remainder hint. */
function renderLabels(s: RenderState): string {
  if (!s.inspector) return "";
  const labels = Object.entries(s.inspector.metadata.labels ?? {});
  const visible = labels.slice(0, 8);
  const labelCount = labels.length;
  const body = visible.length
    ? `<div class="inspector-labels">${visible.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v || '""')}</strong></div>`).join("")}</div>`
    : `<p class="muted-empty">No labels on this resource.</p>`;
  const tail = labelCount > 8 ? `<small class="muted-empty">Showing 8 of ${labelCount} labels</small>` : "";
  return `${body}${tail}`;
}

/** Footer buttons differ by view: only log-capable views get the log action. */
function renderFooter(s: RenderState): string {
  if (!s.inspector) return "";
  return `<footer class="inspector-footer">
    ${logKinds.has(s.view as ResourceKey) ? `<button class="button secondary" data-action="open-logs-inspector" data-log-opener="inspector" aria-label="Open logs for ${escapeHtml(s.inspector.metadata.name)}">View logs</button>` : ""}
    <button class="button secondary" data-action="copy-name">${icon("copy")} Copy resource name</button>
    <button class="button primary" data-action="copy-manifest">${icon("copy")} Copy manifest</button>
  </footer>`;
}

/** Right-side inspector for one selected resource. */
export function renderInspector(s: RenderState): string {
  if (!s.inspector) return "";
  const r = s.inspector;
  const labelCount = Object.keys(r.metadata.labels ?? {}).length;
  const status = rowStatus(r, s.view as ResourceKey);
  return `<div class="inspector-backdrop"><aside class="inspector" role="dialog" aria-modal="true" aria-label="${escapeHtml(r.kind)} inspector">
    <header class="inspector-header">
      <div><div class="eyebrow">RESOURCE INSPECTOR</div><h2>${escapeHtml(r.kind)}</h2></div>
      <button class="icon-button" data-action="close-inspector" aria-label="Close inspector">${icon("close")}</button>
    </header>
    <div class="inspector-identity">
      <span class="resource-avatar large">${escapeHtml(inspectorIcon(s))}</span>
      <div><strong>${escapeHtml(r.metadata.name)}</strong><span>${escapeHtml(identity(r))}</span></div>
      <button class="icon-button small" data-action="copy-name" title="Copy resource name" aria-label="Copy resource name">${icon("copy")}</button>
    </div>
    <div class="inspector-facts">
      <div><span>NAMESPACE</span><strong>${escapeHtml(r.metadata.namespace ?? "Cluster-scoped")}</strong></div>
      <div><span>STATUS</span><strong class="${statusTone(status)}">${escapeHtml(status)}</strong></div>
      <div><span>AGE</span><strong>${escapeHtml(age(r))}</strong></div>
      <div><span>LABELS</span><strong>${labelCount}</strong></div>
    </div>
    ${r.kind === "Event" ? `<section class="inspector-section"><h3>Event message</h3><p class="event-message">${escapeHtml(r.message ?? "-")}</p></section>` : ""}
    <section class="inspector-section">
      <div class="inspector-section-title"><h3>Labels</h3><span>${labelCount}</span></div>
      ${renderLabels(s)}
    </section>
    <section class="inspector-section manifest-section">
      <div class="inspector-section-title"><h3>Manifest</h3><button class="subtle-button" data-action="copy-manifest">${icon("copy")} Copy YAML</button></div>
      <pre class="yaml-manifest">${highlightYaml(manifestYaml(r))}</pre>
    </section>
    ${renderFooter(s)}
  </aside></div>`;
}

defineComponent("orbita-inspector", renderInspector);
