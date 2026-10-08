/**
 * Bun tests for metric-card targets, percentage rendering, and escaped custom-element attributes.
 * @module tests/components/metric-card.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { metricCardTag, renderMetric } from "../../src/components/metric-card";

describe("orbita-metric-card", () => {
  test("renders a button targeting the view with label, value and percent", () => {
    const html = renderMetric("PODS RUNNING", "5", "1 need attention", 83.4, "blue", "▣", "pods");
    expect(html).toContain('<button type="button" class="metric-card blue" data-view="pods" data-metric="PODS RUNNING"');
    expect(html).toContain("83% of total");
    expect(html).toContain("width:83%");
  });
  test("tag carries every value as an escaped attribute", () => {
    const tag = metricCardTag('A"B', "1", "<d>", 50, "mint", "x", "nodes");
    expect(tag).toContain('label="A&quot;B"');
    expect(tag).toContain('detail="&lt;d&gt;"');
    expect(tag).toContain('target="nodes"');
    expect(tag.startsWith("<orbita-metric-card ")).toBe(true);
  });
});
