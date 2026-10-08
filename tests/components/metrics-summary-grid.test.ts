/**
 * Bun tests for four usage-summary cards and metrics.k8s.io-shaped resource quantities.
 * @module tests/components/metrics-summary-grid.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { renderMetricsSummaryGrid } from "../../src/components/metrics-summary-grid";
import { makeState } from "../helpers";

describe("orbita-metrics-summary-grid", () => {
  test("renders four usage summary cards", () => {
    const html = renderMetricsSummaryGrid(makeState());
    expect(html.match(/class="usage-summary-card/g)).toHaveLength(4);
    expect(html).toContain("NODE CPU");
    expect(html).toContain("NODE MEMORY");
    expect(html).toContain("POD CPU");
    expect(html).toContain("POD MEMORY");
  });

  test("uses metrics.k8s.io-shaped usage values when available", () => {
    const html = renderMetricsSummaryGrid(makeState());
    expect(html).toContain("metrics.k8s.io");
    expect(html).toContain("nodes reporting");
    expect(html).toContain("pods reporting");
    expect(html).toContain("data-view=\"nodes\"");
    expect(html).toContain("data-view=\"pods\"");
  });
});
