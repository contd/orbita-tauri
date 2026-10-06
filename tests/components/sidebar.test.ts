import { describe, expect, test } from "bun:test";
import { definitions, demo, groups } from "../../src/kubernetes";
import { renderSidebar } from "../../src/components/sidebar";
import { makeState } from "../helpers";

describe("orbita-sidebar", () => {
  test("lists every group and every resource view", () => {
    const html = renderSidebar(makeState());
    for (const g of groups) expect(html).toContain(`data-group="${g}"`);
    for (const d of definitions) expect(html).toContain(`data-view="${d.key}"`);
    expect(html).toContain('data-view="dashboard"');
    expect(html).toContain('data-view="settings"');
  });
  test("marks the active view", () => {
    const html = renderSidebar(makeState({ view: "pods" }));
    expect(html).toMatch(/nav-item active" data-view="pods"/);
    expect(html).not.toMatch(/nav-item active" data-view="nodes"/);
  });
  test("counts appear only for loaded, non-empty collections", () => {
    const html = renderSidebar(makeState());
    expect(html).toContain(`<span class="nav-count">${demo.pods.length}</span>`);
    expect(html.match(/nav-count/g)).toHaveLength(1);
  });
  test("collapsed group hides its items and reports aria-expanded=false", () => {
    const html = renderSidebar(makeState({ collapsed: new Set(["Workloads"]) }));
    expect(html).toContain('data-group="Workloads" aria-expanded="false"');
    expect(html).not.toContain('data-view="pods"');
  });
  test("cluster card renders the context selector component", () => {
    const html = renderSidebar(makeState({ contextNames: ["a", "<b>"], selectedContext: "a" }));
    expect(html).toContain("<orbita-context-select></orbita-context-select>");
  });
  test("puts Add kubeconfig in the cluster card, not the nav, and omits the namespace", () => {
    const html = renderSidebar(makeState());
    const card = html.slice(html.indexOf('class="cluster-card"'), html.indexOf('class="nav-scroll"'));
    expect(card).toContain('data-action="add-config"');
    expect(html.slice(html.indexOf('class="nav-scroll"'))).not.toContain("add-config");
    expect(card).not.toContain("Namespace");
  });
  test("has a toggle whose label and state follow the collapsed flag", () => {
    const open = renderSidebar(makeState());
    expect(open).toContain('data-action="toggle-sidebar"');
    expect(open).toContain('aria-label="Collapse sidebar"');
    expect(open).not.toContain("sidebar-collapsed");
    const closed = renderSidebar(makeState({ sidebarCollapsed: true }));
    expect(closed).toContain('aria-label="Expand sidebar"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain("sidebar-collapsed");
  });
  test("collapsed rail keeps every nav item reachable with an accessible name", () => {
    const html = renderSidebar(makeState({ sidebarCollapsed: true, collapsed: new Set(["Workloads"]) }));
    expect(html).toContain('data-view="deployments"');
    expect(html).toContain('aria-label="Settings"');
  });
});
