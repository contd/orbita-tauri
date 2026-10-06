import { describe, expect, test } from "bun:test";
import { renderLogs } from "../../src/components/logs";
import { makeState } from "../helpers";
import type { LogsState } from "../../src/components/types";

const logs = (over: Partial<LogsState>): LogsState => ({ title: "Logs · Pod x", body: "line", state: "ready", opener: "inspector", ...over });

describe("orbita-logs", () => {
  test("renders nothing while closed", () => {
    expect(renderLogs(makeState())).toBe("");
  });
  test("is a dialog titled with the resource and shows the body", () => {
    const html = renderLogs(makeState({ logs: logs({}) }));
    expect(html).toContain('aria-labelledby="logs-title"');
    expect(html).toContain("Logs · Pod x");
    expect(html).toContain(">line</pre>");
  });
  test("loading and empty states show placeholders", () => {
    expect(renderLogs(makeState({ logs: logs({ state: "loading", body: "" }) }))).toContain("Loading logs…");
    expect(renderLogs(makeState({ logs: logs({ state: "empty", body: "" }) }))).toContain("No log output was returned.");
  });
  test("errors are styled and log content is escaped", () => {
    const html = renderLogs(makeState({ logs: logs({ state: "error", body: "<script>x</script>" }) }));
    expect(html).toContain("logs-error");
    expect(html).not.toContain("<script>");
  });
});
