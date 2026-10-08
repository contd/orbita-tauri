/**
 * Bun tests for view-specific toolbar controls, namespace scope, and escaped selections/search.
 * @module tests/components/header.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { renderHeader } from "../../src/components/header";
import { makeState } from "../helpers";

describe("orbita-header", () => {
  test("dashboard shows search, namespace, refresh and terminal controls", () => {
    const html = renderHeader(makeState());
    for (const label of ["Search resources", "Namespace", "Refresh cluster", "Open kubectl terminal", "Density", "Toggle light and dark theme"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("<strong>Dashboard</strong>");
  });
  test("cluster-scoped views have no namespace selector", () => {
    expect(renderHeader(makeState({ view: "nodes" }))).not.toContain("namespace-select");
    expect(renderHeader(makeState({ view: "pods" }))).toContain("namespace-select");
  });
  test("settings and about hide search and refresh", () => {
    const html = renderHeader(makeState({ view: "settings" }));
    expect(html).not.toContain("search-input");
    expect(html).not.toContain("Refresh cluster");
    expect(renderHeader(makeState({ view: "about" }))).toContain("About Orbita");
  });
  test("density and namespace selections are reflected and escaped", () => {
    const html = renderHeader(makeState({ settings: { ...makeState().settings, density: "cozy", namespace: "<x>" } }));
    expect(html).toContain('<option value="cozy" selected>');
    expect(html).not.toContain("<x>");
  });
  test("search text is escaped into the input", () => {
    expect(renderHeader(makeState({ search: '"><b>' }))).not.toContain('"><b>');
  });
});
