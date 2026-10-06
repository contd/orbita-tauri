import { escapeHtml } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

/** User-facing text for the current logs drawer state. */
function logsBodyText(s: RenderState): string {
  if (!s.logs) return "";
  if (s.logs.state === "loading") return "Loading logs…";
  if (s.logs.state === "empty") return "No log output was returned.";
  return s.logs.body;
}

/** Bottom drawer for resource logs. */
export function renderLogs(s: RenderState): string {
  if (!s.logs) return "";
  const body = logsBodyText(s);
  return `<aside class="logs-drawer" role="dialog" aria-modal="false" aria-labelledby="logs-title">
    <header>
      <h3 id="logs-title">${escapeHtml(s.logs.title)}</h3>
      <button class="icon-button small" data-action="close-logs" aria-label="Close logs">${icon("close")}</button>
    </header>
    <pre class="logs-output ${s.logs.state === "error" ? "logs-error" : ""}" role="log" aria-live="polite" aria-label="Log output">${escapeHtml(body)}</pre>
  </aside>`;
}

defineComponent("orbita-logs", renderLogs);
