import { definitions, escapeHtml, getDef, type ResourceKey } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

/** `true` when the current view is one of the resource collections. */
function isResourceView(s: RenderState): s is RenderState & { view: ResourceKey } {
  return definitions.some(d => d.key === s.view);
}

/** Page heading shown in the breadcrumb. */
function viewTitle(s: RenderState): string {
  if (s.view === "dashboard") return "Dashboard";
  if (s.view === "settings") return "Settings";
  if (s.view === "about") return "About Orbita";
  return getDef(s.view).label;
}

/** Dashboard and resource views support search, refresh and terminal actions. */
function isClusterWorkArea(s: RenderState): boolean {
  return s.view === "dashboard" || isResourceView(s);
}

/** `true` when namespace selection is meaningful for the view. */
function showsNamespaceSelect(s: RenderState): boolean {
  return s.view === "dashboard" || (isResourceView(s) && !!getDef(s.view).namespaced);
}

function renderSearch(s: RenderState): string {
  return `<label class="global-search">
    ${icon("search")}
    <input id="search-input" type="search" value="${escapeHtml(s.search)}" placeholder="Search resources..." aria-label="Search resources">
    <kbd>⌘ K</kbd>
  </label>`;
}

function renderNamespaceSelect(s: RenderState): string {
  const options = ["All namespaces", ...s.snapshot.namespaces.map(n => n.metadata.name)]
    .map(n => `<option ${s.settings.namespace === n ? "selected" : ""}>${escapeHtml(n)}</option>`)
    .join("");
  return `<label class="select-control header-select">
    <span>Namespace</span>
    <select id="namespace-select" aria-label="Namespace">${options}</select>
  </label>`;
}

function renderDensitySelect(s: RenderState): string {
  return `<label class="density-wrap" title="Density">
    <span class="density-icon">☷</span>
    <select id="density-select" aria-label="Density">
      <option value="cozy" ${s.settings.density === "cozy" ? "selected" : ""}>Cozy</option>
      <option value="normal" ${s.settings.density === "normal" ? "selected" : ""}>Normal</option>
      <option value="compact" ${s.settings.density === "compact" ? "selected" : ""}>Compact</option>
    </select>
  </label>`;
}

/** Top header with breadcrumb and global actions. */
export function renderHeader(s: RenderState): string {
  const clusterWorkArea = isClusterWorkArea(s);
  const title = viewTitle(s);
  return `<header class="topbar">
    <div class="breadcrumb">
      <span>Cluster</span>
      <span class="crumb-sep">/</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="top-actions">
      ${clusterWorkArea ? renderSearch(s) : ""}
      ${showsNamespaceSelect(s) ? renderNamespaceSelect(s) : ""}
      ${clusterWorkArea ? `<button class="icon-button" data-action="refresh" aria-label="Refresh cluster" title="Refresh cluster">${icon("refresh")}</button>` : ""}
      <div class="divider"></div>
      <button class="icon-button" data-action="toggle-theme" aria-label="Toggle light and dark theme" title="Toggle theme">${icon(s.settings.theme === "dark" ? "sun" : "moon")}</button>
      ${renderDensitySelect(s)}
      <button class="toolbar-button" data-action="open-terminal" aria-label="Open kubectl terminal"><span class="terminal-glyph">&gt;_</span><span>Terminal</span></button>
      <button class="toolbar-button" data-view="settings">${icon("settings")}<span>Settings</span></button>
    </div>
  </header>`;
}

defineComponent("orbita-header", renderHeader);
