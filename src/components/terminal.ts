import { escapeHtml, highlightJson, highlightTerminalText } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

/** Header with the title, the bound context and the expand / clear / close controls. */
function renderHeading(s: RenderState, off: string): string {
  const toggleLabel = s.terminalExpanded ? "Collapse" : "Expand";
  const other = s.terminalFormat === "json" ? "text" : "JSON";
  const pressed = s.terminalFormat === "json";
  return `
    <div class="panel-heading terminal-heading">
      <div>
        <span class="terminal-icon">&gt;_</span>
        <div>
          <h3 id="terminal-title">Kubectl terminal</h3>
          <p>Run commands against <strong>${escapeHtml(s.selectedContext)}</strong></p>
        </div>
      </div>
      <div class="terminal-actions">
        <button class="format-toggle" data-action="toggle-format" aria-label="Output format: ${pressed ? "JSON" : "text"}. Switch to ${other}" title="Switch output to ${other}" aria-pressed="${pressed}" ${off}>
          <span class="format-toggle-thumb" aria-hidden="true"></span>
          <span class="format-toggle-option">TEXT</span>
          <span class="format-toggle-option">JSON</span>
        </button>
        <button class="icon-button small" data-action="toggle-terminal" aria-label="${toggleLabel} panel" title="${toggleLabel} panel to ${s.terminalExpanded ? "two thirds" : "full"} height" ${off}>⤢</button>
        <button class="icon-button small" data-action="clear-output" aria-label="Clear output" title="Clear output" ${off}>⌫</button>
        <button class="icon-button small" data-action="clear-history" aria-label="Clear history" title="Clear history" ${off}>⌁</button>
        <button class="icon-button small" data-action="close-terminal" aria-label="Close terminal" title="Close terminal">${icon("close")}</button>
      </div>
    </div>`;
}

/** Clickable list of previously run commands, or a hint when there are none. */
function renderHistory(s: RenderState): string {
  if (!s.terminalHistory.length) {
    return `<div class="history-empty">Your recent commands will appear here.<br><code>kubectl get pods -A</code></div>`;
  }
  return s.terminalHistory.map(h => `
        <button class="history-entry" data-command="${escapeHtml(h.command)}">
          <span>$</span> ${escapeHtml(h.command)}<small>${escapeHtml(h.status)}</small>
        </button>`).join("");
}

/** Left pane: command history above the command entry form. */
function renderCommandPane(s: RenderState, off: string): string {
  // The textarea's text must follow its opening tag directly, or the whitespace would become part of the command.
  return `
      <div class="terminal-command-pane">
        <div class="terminal-pane-title">
          COMMAND HISTORY
          <button data-action="clear-history" aria-label="Clear command history" ${off}>Clear</button>
        </div>
        <div class="command-history">${renderHistory(s)}</div>
        <form id="terminal-form" class="terminal-form">
          <span>$</span>
          <textarea id="terminal-input" rows="1" wrap="soft" spellcheck="false" placeholder="kubectl get pods" aria-label="Kubectl command" autocomplete="off" autocapitalize="off" ${off}>${escapeHtml(s.terminalInput)}</textarea>
          <button type="button" data-action="run-terminal" aria-label="Run command" ${off}>Run&nbsp; ↗</button>
        </form>
      </div>`;
}

/** Output area content: the last command's stdout, stderr and exit code, or a placeholder before any run. */
function renderOutput(s: RenderState): string {
  if (s.terminalStatus === null) {
    return `
          <div class="output-placeholder">
            <span>⌁</span>
            <strong>Ready for your first command</strong>
            <small>Output will appear here</small>
          </div>`;
  }
  const body = s.terminalFormat === "json" ? highlightJson(s.terminalOutput) : highlightTerminalText(s.terminalOutput);
  const stdout = s.terminalOutput ? `<pre class="terminal-stdout">${body}</pre>` : "";
  const stderr = s.terminalStderr ? `<pre class="terminal-stderr">${highlightTerminalText(s.terminalStderr)}</pre>` : "";
  const outcome = s.terminalStatus === "0" ? "success" : "failure";
  return `
          ${stdout}
          ${stderr}
          <div class="terminal-exit ${outcome}">Process exited with code ${escapeHtml(s.terminalStatus)}</div>`;
}

/** Right pane: titled output log. */
function renderOutputPane(s: RenderState): string {
  return `
      <div class="terminal-output-pane">
        <div class="terminal-pane-title">OUTPUT <span class="output-context">${escapeHtml(s.selectedContext)}</span></div>
        <div class="terminal-output" id="terminal-output" role="log" aria-live="polite" aria-label="Terminal output">${renderOutput(s)}
        </div>
      </div>`;
}

/** Draggable divider between command history and output panes. */
function renderSplitter(s: RenderState): string {
  const enabled = s.cli.kubectl;
  return `
      <div class="terminal-splitter" role="separator" aria-label="Resize history and output panes" aria-orientation="vertical" aria-valuemin="14" aria-valuemax="55" aria-valuenow="${Math.round(s.terminalSplit)}" tabindex="${enabled ? "0" : "-1"}"></div>`;
}

/** Card laid over the panel when kubectl is not installed. */
function renderMissingKubectl(): string {
  return `
    <div class="terminal-overlay">
      <div class="terminal-overlay-card">
        <span>⌘</span>
        <strong>kubectl not detected</strong>
        <p>Install kubectl and restart Orbita to enable the terminal. All other cluster views remain available in demo mode.</p>
      </div>
    </div>`;
}

/**
 * Renders the kubectl terminal panel that rises from the status bar.
 * @param s - Current state; reads the open flag, command text, output, history and tool detection.
 * @returns The panel HTML, or an empty string while the terminal is closed.
 */
export function renderTerminal(s: RenderState): string {
  if (!s.terminalOpen) return "";
  const off = !s.cli.kubectl ? "disabled" : "";
  const classes = ["panel", "terminal-panel", !s.cli.kubectl && "terminal-disabled", s.terminalExpanded && "terminal-expanded"].filter(Boolean).join(" ");
  return `
<div class="terminal-backdrop">
  <section class="${classes}" role="dialog" aria-modal="true" aria-labelledby="terminal-title">${renderHeading(s, off)}
    <div class="terminal-body" style="--terminal-left:${s.terminalSplit}%;">${renderCommandPane(s, off)}${renderSplitter(s)}${renderOutputPane(s)}
    </div>${!s.cli.kubectl ? renderMissingKubectl() : ""}
  </section>
</div>`;
}

defineComponent("orbita-terminal", renderTerminal);
