import { describe, expect, test } from "bun:test";
import { demo } from "../../src/kubernetes";
import { filteredResources, renderResourceTable } from "../../src/components/resource-table";
import { makeState } from "../helpers";

describe("orbita-resource-table", () => {
  test("renders Name first, then schema columns, then an action column", () => {
    const html = renderResourceTable(makeState({ view: "pods" }), "pods");
    expect(html).toMatch(/data-sort="Name"[\s\S]*data-sort="Namespace"/);
    expect(html).toContain('class="action-header"');
    expect(html).toContain('class="table-col-resizer"');
  });
  test("every row is a focusable button with an accessible name", () => {
    const html = renderResourceTable(makeState({ view: "pods" }), "pods");
    expect(html.match(/class="resource-row"/g)).toHaveLength(demo.pods.length);
    expect(html).toContain(`aria-label="Inspect Pod ${demo.pods[0].metadata.name}"`);
  });
  test("shows the empty state with a clear-search action", () => {
    const html = renderResourceTable(makeState({ view: "pods", search: "zzz-none" }), "pods");
    expect(html).toContain("No resources found");
    expect(html).toContain('data-action="clear-search"');
  });
  test("sort indicator follows direction", () => {
    const up = renderResourceTable(makeState({ view: "pods", sort: { column: "Name", direction: 1 } }), "pods");
    const down = renderResourceTable(makeState({ view: "pods", sort: { column: "Name", direction: -1 } }), "pods");
    expect(up).toContain("<span>↑</span>");
    expect(down).toContain("<span>↓</span>");
  });
  test("loading state replaces the count", () => {
    expect(renderResourceTable(makeState({ view: "pods", loadingCollections: new Set(["pods"]) }), "pods")).toContain("Loading…");
  });
  test("filteredResources applies namespace, search and sorting", () => {
    const base = makeState({ view: "pods" });
    const ns = demo.pods[0].metadata.namespace!;
    const inNs = filteredResources({ ...base, settings: { ...base.settings, namespace: ns } }, "pods");
    expect(inNs.every(r => r.metadata.namespace === ns)).toBe(true);
    const found = filteredResources({ ...base, search: demo.pods[1].metadata.name }, "pods");
    expect(found.map(r => r.metadata.name)).toContain(demo.pods[1].metadata.name);
    const desc = filteredResources({ ...base, sort: { column: "Name", direction: -1 } }, "pods").map(r => r.metadata.name);
    expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })));
  });
  test("cluster-scoped kinds ignore the namespace filter", () => {
    const base = makeState({ view: "nodes" });
    expect(filteredResources({ ...base, settings: { ...base.settings, namespace: "payments" } }, "nodes")).toHaveLength(demo.nodes.length);
  });
  test("applies saved column widths for the active resource table", () => {
    const html = renderResourceTable(makeState({ view: "pods", tableColumnWidths: { pods: [210, 140, 120, 80] } }), "pods");
    expect(html).toContain('<col data-column-index="0" style="width:210px">');
    expect(html).toContain('<col data-column-index="3" style="width:80px">');
  });
  test("namespace label cells are truncated at 100 chars and keep full hover text", () => {
    const longLabel = "x".repeat(120);
    const snapshot = structuredClone(demo);
    snapshot.namespaces[0].metadata.labels = { long: longLabel, team: "platform" };
    const html = renderResourceTable(makeState({ view: "namespaces", snapshot }), "namespaces");
    const full = `long=${longLabel}, team=platform`;
    const preview = `${full.slice(0, 100)}...`;
    expect(html).toContain(`>${preview}</span>`);
    expect(html).toContain(`data-full-labels="${full}"`);
    expect(html).toContain(`title="${full}"`);
  });
});
