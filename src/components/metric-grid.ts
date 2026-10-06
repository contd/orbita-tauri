import { nodeReady, workloadReadiness } from "../kubernetes";
import { defineComponent } from "./base";
import { metricCardTag } from "./metric-card";
import type { RenderState } from "./types";

/** Clamps a readiness ratio to a safe 0-100 percentage. */
function ratio(ready: number, total: number): number {
  return total ? Math.max(0, Math.min(100, (ready / total) * 100)) : 0;
}

/** Reusable dashboard-style metric cards for high-level cluster health. */
export function renderMetricGrid(s: RenderState): string {
  const pods = s.snapshot.pods;
  const runningPods = pods.filter(p => p.status?.phase === "Running").length;

  const nodes = s.snapshot.nodes;
  const readyNodes = nodes.filter(nodeReady).length;

  const workloads = [...s.snapshot.deployments, ...s.snapshot.daemonsets, ...s.snapshot.statefulsets];
  const desiredReplicas = workloads.reduce((count, resource) => count + workloadReadiness(resource).desired, 0);
  const readyReplicas = workloads.reduce((count, resource) => count + workloadReadiness(resource).ready, 0);

  const warningCount = s.snapshot.events.filter(event => event.type === "Warning").length + nodes.length - readyNodes;

  return `<div class="metric-grid-stack">
    <div class="metric-grid">
      ${metricCardTag("PODS RUNNING", `${runningPods}<span class="metric-slash">/${pods.length}</span>`, `${pods.length - runningPods} need attention`, ratio(runningPods, pods.length), "blue", "▣", "pods")}
      ${metricCardTag("NODES READY", `${readyNodes}<span class="metric-slash">/${nodes.length}</span>`, `${nodes.length - readyNodes} node needs attention`, ratio(readyNodes, nodes.length), "mint", "⬡", "nodes")}
      ${metricCardTag("WORKLOADS READY", `${readyReplicas}<span class="metric-slash">/${desiredReplicas}</span>`, `${workloads.length} workloads across cluster`, ratio(readyReplicas, desiredReplicas), "violet", "◫", "daemonsets")}
      ${metricCardTag("WARNINGS", `${warningCount}`, "Across events and node health", ratio(Math.max(0, 4 - warningCount), 4), warningCount ? "amber" : "mint", "⚠", "events")}
    </div>
    <orbita-metrics-summary-grid></orbita-metrics-summary-grid>
  </div>`;
}

defineComponent("orbita-metric-grid", renderMetricGrid);
