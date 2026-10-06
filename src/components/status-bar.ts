import { escapeHtml } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";
import "./cli-status";

/** Dismissible message pill shown beside the tool pills; empty when there is no notice. */
function renderNotice(s: RenderState): string {
  if (!s.notice) return "";
  return `
    <span class="cli-pill status-notice" role="status">
      <span class="cli-dot up"></span>
      <span class="notice-text">${escapeHtml(s.notice)}</span>
      <button aria-label="Dismiss notice" data-action="dismiss-notice">${icon("close")}</button>
    </span>`;
}

/**
 * Renders the status bar: connection, tool detection, the latest notice, the terminal button and the version.
 * @param s - Current state; reads the selected context, notice, app metadata and whether a host is attached.
 * @returns The footer HTML.
 */
export function renderStatusBar(s: RenderState): string {
  const demoMarker = s.bridged ? "" : " · Demo mode";
  return `
<footer class="status-bar">
  <span class="cluster-connected">
    <span class="connected-dot"></span>Connected to <strong>${escapeHtml(s.selectedContext)}</strong>
  </span>
  <orbita-cli-status></orbita-cli-status>${renderNotice(s)}
  <span class="status-spacer"></span>
  <button class="status-button" data-action="open-terminal" aria-label="Open kubectl terminal in status bar">
    <span class="terminal-glyph">&gt;_</span> Terminal
  </button>
  <span class="footer-meta">Orbita v${escapeHtml(s.about.version)}${demoMarker}</span>
</footer>`;
}

defineComponent("orbita-status-bar", renderStatusBar);
