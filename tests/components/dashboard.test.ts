import { describe, expect, test } from "bun:test";
import { demo } from "../../src/kubernetes";
import { eyebrowDate, greeting, renderDashboard } from "../../src/components/dashboard";
import { renderMetricGrid } from "../../src/components/metric-grid";
import { renderOverviewGrid } from "../../src/components/overview-grid";
import { makeState } from "../helpers";

describe("orbita-dashboard", () => {
  test("renders reusable metric and overview sections", () => {
    const html = renderDashboard(makeState());
    expect(html).toContain("<orbita-metric-grid></orbita-metric-grid>");
    expect(html).toContain("<orbita-overview-grid></orbita-overview-grid>");
  });
  test("metric grid renders four metric cards pointing at their views", () => {
    const html = renderMetricGrid(makeState());
    expect(html.match(/<orbita-metric-card /g)).toHaveLength(4);
    expect(html).toContain("<orbita-metrics-summary-grid></orbita-metrics-summary-grid>");
    for (const target of ["pods", "nodes", "daemonsets", "events"]) expect(html).toContain(`target="${target}"`);
  });
  test("pod counts match the data", () => {
    const running = demo.pods.filter(p => p.status?.phase === "Running").length;
    expect(renderMetricGrid(makeState())).toContain(`${running}&lt;span class=&quot;metric-slash&quot;&gt;/${demo.pods.length}`);
  });
  test("shows the update time and no longer renders the notice", () => {
    const html = renderOverviewGrid(makeState({ notice: "unique-notice", refreshTime: "5m ago" }));
    expect(html).not.toContain("unique-notice");
    expect(html).not.toContain("dismiss-notice");
    expect(html).toContain("Updated 5m ago");
  });
  test("lists at most four recent events, newest first", () => {
    const html = renderOverviewGrid(makeState());
    expect(html.match(/class="event-row"/g)!.length).toBeLessThanOrEqual(4);
  });
  test("workload rows and mini stats navigate to their resource views", () => {
    const html = renderOverviewGrid(makeState());
    expect(html).toContain('class="workload-row workload-link" data-view="deployments"');
    expect(html).toContain('class="workload-row workload-link" data-view="statefulsets"');
    expect(html).toContain('class="workload-row workload-link" data-view="daemonsets"');
    expect(html).toContain('class="mini-stats mini-stats-link" data-view="pods"');
  });
  test("renders no table", () => {
    expect(renderDashboard(makeState())).not.toContain("<table");
  });
  test("greets by local hour", () => {
    const at = (h: number) => new Date(2026, 9, 5, h, 30);
    expect(greeting(at(0))).toBe("Good morning");
    expect(greeting(at(11))).toBe("Good morning");
    expect(greeting(at(12))).toBe("Good afternoon");
    expect(greeting(at(17))).toBe("Good afternoon");
    expect(greeting(at(18))).toBe("Good evening");
    expect(greeting(at(23))).toBe("Good evening");
  });
  test("shows the real date and matching greeting in the title row", () => {
    const html = renderDashboard(makeState(), new Date(2026, 9, 5, 19, 0));
    expect(html).toContain("OCT 05, 2026");
    expect(html).toContain("Good evening");
    expect(html).not.toContain("OCT 03, 2026");
    expect(eyebrowDate(new Date(2027, 0, 9))).toBe("JAN 09, 2027");
  });
});
