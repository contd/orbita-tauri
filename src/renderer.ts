/**
 * Rendering layer for Orbita.
 *
 * The UI is a set of light-DOM custom elements (see `./components`). This module wires them together:
 * it re-exports every pure `render*` function (handy for unit tests), composes the application shell in
 * {@link renderApp}, mounts it with {@link mount}, and is the only place that touches the browser `document`.
 * @module renderer
 */
import { setCurrentState } from "./components/base";
import "./components/sidebar";
import "./components/context-select";
import "./components/header";
import "./components/cli-status";
import "./components/status-bar";
import "./components/metric-card";
import "./components/metric-grid";
import "./components/metrics-summary-grid";
import "./components/overview-grid";
import "./components/dashboard";
import "./components/resource-table";
import "./components/inspector";
import "./components/settings";
import "./components/about";
import "./components/dialog";
import "./components/terminal";
import "./components/logs";
import type { RenderState } from "./components/types";
import { viewTag } from "./views";
import "./views/resource-views";

/** Re-exports the shared state and view types so consumers import everything UI-related from one module. */
export * from "./components/types";
export { icon } from "./components/icons";
export { renderSidebar } from "./components/sidebar";
export { renderContextSelect } from "./components/context-select";
export { renderHeader } from "./components/header";
export { renderCli } from "./components/cli-status";
export { renderStatusBar } from "./components/status-bar";
export { renderMetric } from "./components/metric-card";
export { renderMetricGrid } from "./components/metric-grid";
export { renderMetricsSummaryGrid } from "./components/metrics-summary-grid";
export { renderOverviewGrid } from "./components/overview-grid";
export { renderDashboard } from "./components/dashboard";
export { renderResourceTable, filteredResources } from "./components/resource-table";
export { renderInspector } from "./components/inspector";
export { renderSettings } from "./components/settings";
export { renderAbout } from "./components/about";
export { renderDialog } from "./components/dialog";
export { renderTerminal } from "./components/terminal";
export { renderLogs } from "./components/logs";
export { viewTag, resourceViewTags, isResourceView, isAppViewName } from "./views";

/**
 * Builds the application shell: the sidebar, header, current page, overlays and status bar as empty custom
 * elements. Each element renders its own content from the current state when the browser connects it.
 *
 * @param s - The state snapshot; `view` chooses the page element and `sidebarCollapsed` the shell width class.
 * @returns HTML for the whole app, ready to assign to the root's `innerHTML`.
 */
export function renderApp(s: RenderState): string {
  const page = viewTag(s.view);
  const tag = (name: string) => `<${name}></${name}>`;
  return `<div class="app-shell ${s.sidebarCollapsed ? "sidebar-collapsed" : ""}">${tag("orbita-sidebar")}<main class="main-area">${tag("orbita-header")}${tag(page)}${tag("orbita-inspector")}${tag("orbita-dialog")}${tag("orbita-terminal")}${tag("orbita-logs")}${tag("orbita-status-bar")}</main></div>`;
}

// ---- DOM access: the only place that touches the document ----

/** Cached `#app` element; `null` until {@link getRoot} is first called. */
let rootElement: HTMLElement | null = null;
/**
 * The `#app` mount point, resolved lazily so the pure renderers stay importable without a DOM.
 * @returns The cached root element.
 */
export function getRoot(): HTMLElement {
  return rootElement ??= document.querySelector<HTMLElement>("#app")!;
}
/**
 * Looks up the first element in the document matching a selector.
 * @typeParam T - Expected element type, e.g. `HTMLInputElement`.
 * @param selector - Any CSS selector.
 * @returns The element, or `null` when nothing matches.
 */
export function query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}
/**
 * Escapes a value so it can be embedded safely inside a CSS selector (for example an attribute value).
 * @param value - Raw text such as a resource identity.
 * @returns The escaped text.
 */
export function escapeSelector(value: string): string { return CSS.escape(value); }
/**
 * The element an event originated from, cast to a concrete element type.
 * @typeParam T - Element type the caller expects.
 * @param event - The DOM event.
 * @returns `event.target` typed as `T`.
 */
export function targetOf<T extends HTMLElement = HTMLElement>(event: Event): T { return event.target as T; }
/**
 * Finds the closest ancestor (or the element itself) matching a selector.
 * @typeParam T - Expected element type.
 * @param target - Element to start from.
 * @param selector - CSS selector to match.
 * @returns The match, or `null` when none exists.
 */
export function closestTo<T extends HTMLElement = HTMLElement>(target: HTMLElement, selector: string): T | null { return target.closest<T>(selector); }

/**
 * Renders the whole application: applies the theme and density to `<html>`, publishes the state to the
 * components, replaces the root markup and scrolls the terminal panes to their latest output.
 * Because the markup is replaced, the focused field (found by id) and its caret are restored afterwards, and a
 * terminal that was already open is not animated again. Background refreshes therefore never interrupt typing.
 * @param s - The state snapshot to render.
 */
export function mount(s: RenderState): void {
  document.documentElement.dataset.theme = s.settings.theme;
  document.documentElement.dataset.density = s.settings.density;
  const root = getRoot();
  const active = document.activeElement as (HTMLInputElement | HTMLTextAreaElement) | null;
  const focusId = active && root.contains(active) ? active.id : "";
  const caret = focusId ? { start: active!.selectionStart, end: active!.selectionEnd } : null;
  const terminalWasOpen = root.querySelector(".terminal-panel") !== null;
  setCurrentState(s);
  root.innerHTML = renderApp(s);
  if (terminalWasOpen) root.querySelector(".terminal-panel")?.classList.add("no-animation");
  if (focusId) {
    const next = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${focusId}`);
    if (next && !next.disabled) {
      next.focus();
      if (caret && caret.start !== null && caret.end !== null) next.setSelectionRange(caret.start, caret.end);
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>(".command-history, .terminal-output")) el.scrollTop = el.scrollHeight;
}
/**
 * Registers a document-level listener, used for global keyboard shortcuts.
 * @typeParam K - Event name key of `DocumentEventMap`.
 * @param type - Event name, such as `"keydown"`.
 * @param handler - Called with the typed event.
 */
export function onDocument<K extends keyof DocumentEventMap>(type: K, handler: (event: DocumentEventMap[K]) => void): void {
  document.addEventListener(type, handler);
}
