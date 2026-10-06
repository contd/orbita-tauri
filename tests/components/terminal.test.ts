import { describe, expect, test } from "bun:test";
import { renderTerminal } from "../../src/components/terminal";
import { makeState } from "../helpers";

const open = { terminalOpen: true };

describe("orbita-terminal", () => {
  test("renders nothing while closed", () => {
    expect(renderTerminal(makeState())).toBe("");
  });
  test("open terminal is a labelled dialog bound to the context", () => {
    const html = renderTerminal(makeState(open));
    expect(html).toContain('aria-labelledby="terminal-title"');
    expect(html).toContain("<strong>test-context</strong>");
    expect(html).toContain('id="terminal-input"');
    expect(html).toContain('class="terminal-splitter"');
    expect(html).toContain("--terminal-left:18%");
    expect(html).toContain("Ready for your first command");
  });
  test("controls are enabled when kubectl exists and there is no overlay", () => {
    const html = renderTerminal(makeState(open));
    expect(html).not.toContain("terminal-overlay");
    expect(html).not.toContain("disabled");
  });
  test("missing kubectl disables controls and shows the overlay", () => {
    const html = renderTerminal(makeState({ ...open, cli: { ...makeState().cli, kubectl: false } }));
    expect(html).toContain("kubectl not detected");
    expect(html).toContain("terminal-disabled");
    expect(html).toContain("disabled");
  });
  test("shows stdout, stderr and the exit code separately", () => {
    const html = renderTerminal(makeState({
      ...open,
      terminalStatus: "1",
      terminalOutput: "kubectl get pods --all-namespaces",
      terminalStderr: "# bad <e>",
    }));
    expect(html).toContain('class="terminal-stdout"');
    expect(html).toContain('class="sh-command"');
    expect(html).toContain('class="sh-flag"');
    expect(html).toContain('class="terminal-stderr"');
    expect(html).toContain('class="sh-comment"');
    expect(html).toContain("Process exited with code 1");
    expect(html).toContain("failure");
    expect(html).not.toContain("<e>");
  });
  test("lists history and reflects the full-height toggle", () => {
    const html = renderTerminal(makeState({ ...open, terminalExpanded: true, terminalHistory: [{ command: "kubectl get pods", output: "", status: "0" }] }));
    expect(html).toContain('data-command="kubectl get pods"');
    expect(html).toContain("terminal-expanded");
    expect(html).toContain('aria-label="Collapse panel"');
  });
  test("format toggle sits left of the expand toggle and names the other format", () => {
    const text = renderTerminal(makeState(open));
    expect(text.indexOf('data-action="toggle-format"')).toBeGreaterThan(-1);
    expect(text.indexOf('data-action="toggle-format"')).toBeLessThan(text.indexOf('data-action="toggle-terminal"'));
    expect(text).toContain("Switch to JSON");
    const json = renderTerminal(makeState({ ...open, terminalFormat: "json", terminalStatus: "0", terminalOutput: "{\"a\": \"<b>\", \"n\": 1}" }));
    expect(json).toContain("Switch to text");
    expect(json).toContain('aria-pressed="true"');
    expect(json).toContain('class="json-key"');
    expect(json).toContain('class="json-string"');
    expect(json).toContain('class="json-number"');
    expect(json).toContain("&lt;b&gt;");
    expect(json).not.toContain("<b>");
  });
  test("format toggle is disabled without kubectl", () => {
    expect(renderTerminal(makeState({ ...open, cli: { ...makeState().cli, kubectl: false } }))).toMatch(/toggle-format"[^>]*disabled/);
  });
});
