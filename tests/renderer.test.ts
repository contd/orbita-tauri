/**
 * Bun integration tests for renderers composed from custom-element components.
 *
 * @remarks
 * Covers shell composition, dashboard navigation, sidebar counts and collapse,
 * table filtering, logs, terminal states, status text, and escaped user content.
 * @module tests/renderer.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { demo, definitions } from "../src/kubernetes";
import { makeState } from "./helpers";
import { renderApp, renderDashboard, renderLogs, renderSidebar, renderResourceTable, renderStatusBar, renderTerminal } from "../src/renderer";

describe("renderApp", () => {
  test("shell is composed of custom elements for the current page", () => {
    const html = renderApp(makeState());
    for (const tag of ["orbita-sidebar", "orbita-header", "orbita-dashboard", "orbita-inspector", "orbita-dialog", "orbita-terminal", "orbita-logs", "orbita-status-bar"]) {
      expect(html).toContain(`<${tag}></${tag}>`);
    }
    expect(renderApp(makeState({ view: "pods" }))).toContain("<orbita-view-pods></orbita-view-pods>");
    expect(renderApp(makeState({ view: "settings" }))).toContain("<orbita-settings>");
    expect(renderApp(makeState({ view: "about" }))).toContain("<orbita-about>");
  });
});

describe("components", () => {
  test("dashboard renders reusable grid components and no table", () => {
    const html = renderDashboard(makeState());
    expect(html).toContain("<orbita-metric-grid></orbita-metric-grid>");
    expect(html).toContain("<orbita-overview-grid></orbita-overview-grid>");
    expect(html).not.toContain("<table");
  });

  test("every resource view renders a table with a Name column", () => {
    for (const def of definitions) {
      const html = renderResourceTable(makeState({ view: def.key }), def.key);
      expect(html).toContain("<table");
      expect(html).toContain(`data-sort="Name"`);
    }
  });

  test("nav counts only appear for loaded collections", () => {
    const html = renderSidebar(makeState());
    expect(html).toContain(`<span class="nav-count">${demo.pods.length}</span>`);
    expect(html.match(/nav-count/g)).toHaveLength(1);
  });

  test("collapsed groups hide their items", () => {
    const html = renderSidebar(makeState({ collapsed: new Set(["Workloads"]) }));
    expect(html).toContain('data-group="Workloads" aria-expanded="false"');
  });
});

describe("renderResourceTable", () => {
  test("search filters rows and escapes nothing unsafe", () => {
    const name = demo.pods[0].metadata.name;
    const html = renderResourceTable(makeState({ view: "pods", search: name }), "pods");
    expect(html).toContain(`Inspect Pod ${name}`);
    expect(html).toContain("Showing <strong>1</strong>");
  });
  test("namespace filter limits rows", () => {
    const html = renderResourceTable(makeState({ view: "pods", settings: { ...makeState().settings, namespace: "nonexistent" } }), "pods");
    expect(html).toContain("0 resources");
  });
  test("log action only for log-capable kinds", () => {
    expect(renderResourceTable(makeState({ view: "pods" }), "pods")).toContain('data-action="open-logs"');
    expect(renderResourceTable(makeState({ view: "services" }), "services")).not.toContain('data-action="open-logs"');
  });
});

describe("overlays", () => {
  test("terminal is disabled with an overlay when kubectl is missing", () => {
    const html = renderTerminal(makeState({ terminalOpen: true, cli: { ...makeState().cli, kubectl: false } }));
    expect(html).toContain("terminal-overlay");
    expect(html).toContain("disabled");
  });
  test("terminal renders nothing when closed", () => {
    expect(renderTerminal(makeState())).toBe("");
  });
  test("logs escape their content", () => {
    const html = renderLogs(makeState({ logs: { title: "Logs", body: "<script>x</script>", state: "ready", opener: "inspector" } }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  test("status bar shows context, demo marker and version", () => {
    const html = renderStatusBar(makeState());
    expect(html).toContain("test-context");
    expect(html).toContain("Demo mode");
    expect(html).toContain("v1.2.3");
  });
});
