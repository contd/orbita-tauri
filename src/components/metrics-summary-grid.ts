import { escapeHtml, type Resource, type ResourceKey } from "../kubernetes";
import { defineComponent } from "./base";
import type { RenderState } from "./types";

type CardTone = "mint" | "blue" | "violet" | "amber" | "neutral";
type UsageCard = {
  label: string;
  value: string;
  detail: string;
  pct: number;
  tone: CardTone;
  symbol: string;
  target: ResourceKey;
};

/** Multipliers for Kubernetes memory quantity suffixes (binary and decimal). */
const memoryUnits: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
};

/** Parses CPU quantities to millicores (`m`). */
function cpuMilli(raw?: string): number | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.endsWith("n")) return Number.parseFloat(text.slice(0, -1)) / 1e6;
  if (text.endsWith("u")) return Number.parseFloat(text.slice(0, -1)) / 1e3;
  if (text.endsWith("m")) return Number.parseFloat(text.slice(0, -1));
  return Number.parseFloat(text) * 1000;
}

/** Parses memory quantities to bytes. */
function memoryBytes(raw?: string): number | null {
  if (!raw) return null;
  const match = /^([-+]?\d*\.?\d+)([A-Za-z]+)?$/.exec(String(raw).trim());
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2] ?? "";
  return value * (memoryUnits[unit] ?? 1);
}

function pct(used: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
}

function cpuText(milli: number): string {
  if (milli >= 1000) return `${(milli / 1000).toFixed(milli % 1000 === 0 ? 0 : 1)} cores`;
  return `${Math.round(milli)}m`;
}

function memoryText(bytes: number): string {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 0 : 1)} Gi`;
  return `${(bytes / 1024 ** 2).toFixed(0)} Mi`;
}

function tone(valuePct: number, samples: number): CardTone {
  if (!samples) return "neutral";
  if (valuePct >= 90) return "amber";
  if (valuePct >= 75) return "violet";
  if (valuePct >= 55) return "blue";
  return "mint";
}

function nodeUsage(resource: Resource): { cpu?: string; memory?: string } | null {
  const usage = resource.usage ?? resource.metrics?.usage;
  if (!usage || typeof usage !== "object") return null;
  return {
    cpu: typeof usage.cpu === "string" ? usage.cpu : undefined,
    memory: typeof usage.memory === "string" ? usage.memory : undefined,
  };
}

function podMetricContainers(resource: Resource): Array<{ usage?: { cpu?: string; memory?: string } }> {
  const direct = Array.isArray(resource.containers) ? resource.containers : [];
  if (direct.length) return direct;
  const nested = Array.isArray(resource.metrics?.containers) ? resource.metrics.containers : [];
  return nested;
}

function nodeCapacityTotals(nodes: Resource[]): { cpu: number; memory: number } {
  return nodes.reduce((totals, node) => {
    totals.cpu += cpuMilli(node.status?.allocatable?.cpu ?? node.status?.capacity?.cpu) ?? 0;
    totals.memory += memoryBytes(node.status?.allocatable?.memory ?? node.status?.capacity?.memory) ?? 0;
    return totals;
  }, { cpu: 0, memory: 0 });
}

function nodeUsageTotals(nodes: Resource[]): { cpu: number; memory: number; cpuSamples: number; memorySamples: number } {
  return nodes.reduce((totals, node) => {
    const usage = nodeUsage(node);
    if (!usage) return totals;
    const cpu = cpuMilli(usage.cpu);
    const memory = memoryBytes(usage.memory);
    if (cpu !== null) {
      totals.cpu += cpu;
      totals.cpuSamples += 1;
    }
    if (memory !== null) {
      totals.memory += memory;
      totals.memorySamples += 1;
    }
    return totals;
  }, { cpu: 0, memory: 0, cpuSamples: 0, memorySamples: 0 });
}

function podUsageTotals(pods: Resource[]): { cpu: number; memory: number; cpuSamples: number; memorySamples: number } {
  return pods.reduce((totals, pod) => {
    const containers = podMetricContainers(pod);
    if (!containers.length) return totals;
    let cpuSeen = false;
    let memorySeen = false;
    for (const container of containers) {
      const cpu = cpuMilli(container.usage?.cpu);
      const memory = memoryBytes(container.usage?.memory);
      if (cpu !== null) {
        totals.cpu += cpu;
        cpuSeen = true;
      }
      if (memory !== null) {
        totals.memory += memory;
        memorySeen = true;
      }
    }
    if (cpuSeen) totals.cpuSamples += 1;
    if (memorySeen) totals.memorySamples += 1;
    return totals;
  }, { cpu: 0, memory: 0, cpuSamples: 0, memorySamples: 0 });
}

function usageValue(used: number, capacity: number, formatter: (value: number) => string, samples: number): string {
  if (!samples || capacity <= 0) return "N/A";
  return `${formatter(used)}<span class="usage-summary-slash">/${formatter(capacity)}</span>`;
}

function usageDetail(kind: "nodes" | "pods", samples: number, total: number, loading: boolean): string {
  if (loading) return `Loading ${kind} metrics…`;
  if (!total) return `No ${kind} loaded`;
  if (!samples) return "metrics.k8s.io unavailable";
  return `${samples}/${total} ${kind} reporting`;
}

function usageCards(s: RenderState): UsageCard[] {
  const nodes = s.snapshot.nodes ?? [];
  const pods = s.snapshot.pods ?? [];
  const nodesLoading = s.loadingCollections.has("nodes");
  const podsLoading = s.loadingCollections.has("pods");
  const nodeCapacity = nodeCapacityTotals(nodes);
  const nodeUsageTotalsValue = nodeUsageTotals(nodes);
  const podUsageTotalsValue = podUsageTotals(pods);

  const nodeCpuPct = pct(nodeUsageTotalsValue.cpu, nodeCapacity.cpu);
  const nodeMemoryPct = pct(nodeUsageTotalsValue.memory, nodeCapacity.memory);
  const podCpuPct = pct(podUsageTotalsValue.cpu, nodeCapacity.cpu);
  const podMemoryPct = pct(podUsageTotalsValue.memory, nodeCapacity.memory);

  return [
    {
      label: "NODE CPU",
      value: usageValue(nodeUsageTotalsValue.cpu, nodeCapacity.cpu, cpuText, nodeUsageTotalsValue.cpuSamples),
      detail: usageDetail("nodes", nodeUsageTotalsValue.cpuSamples, nodes.length, nodesLoading),
      pct: nodeCpuPct,
      tone: tone(nodeCpuPct, nodeUsageTotalsValue.cpuSamples),
      symbol: "⚙",
      target: "nodes",
    },
    {
      label: "NODE MEMORY",
      value: usageValue(nodeUsageTotalsValue.memory, nodeCapacity.memory, memoryText, nodeUsageTotalsValue.memorySamples),
      detail: usageDetail("nodes", nodeUsageTotalsValue.memorySamples, nodes.length, nodesLoading),
      pct: nodeMemoryPct,
      tone: tone(nodeMemoryPct, nodeUsageTotalsValue.memorySamples),
      symbol: "◫",
      target: "nodes",
    },
    {
      label: "POD CPU",
      value: usageValue(podUsageTotalsValue.cpu, nodeCapacity.cpu, cpuText, podUsageTotalsValue.cpuSamples),
      detail: usageDetail("pods", podUsageTotalsValue.cpuSamples, pods.length, podsLoading),
      pct: podCpuPct,
      tone: tone(podCpuPct, podUsageTotalsValue.cpuSamples),
      symbol: "◍",
      target: "pods",
    },
    {
      label: "POD MEMORY",
      value: usageValue(podUsageTotalsValue.memory, nodeCapacity.memory, memoryText, podUsageTotalsValue.memorySamples),
      detail: usageDetail("pods", podUsageTotalsValue.memorySamples, pods.length, podsLoading),
      pct: podMemoryPct,
      tone: tone(podMemoryPct, podUsageTotalsValue.memorySamples),
      symbol: "▥",
      target: "pods",
    },
  ];
}

function renderCard(card: UsageCard): string {
  return `<button type="button" class="usage-summary-card ${card.tone}" data-view="${card.target}" data-usage-metric="${escapeHtml(card.label)}" aria-label="${escapeHtml(card.label)} metric summary">
    <div class="usage-summary-top">
      <span class="usage-summary-icon">${card.symbol}</span>
      <span class="usage-summary-kicker">${escapeHtml(card.label)}</span>
      <span class="usage-summary-menu">···</span>
    </div>
    <div class="usage-summary-value">${card.value}</div>
    <div class="usage-summary-detail">${escapeHtml(card.detail)}</div>
    <div class="usage-summary-track"><span style="width:${Math.round(card.pct)}%"></span></div>
    <div class="usage-summary-footer">
      <span>${Math.round(card.pct)}% used</span>
      <span class="usage-summary-source">metrics.k8s.io</span>
    </div>
  </button>`;
}

/** Summary cards for metrics-server (`/apis/metrics.k8s.io/v1beta1`) node/pod CPU and memory usage. */
export function renderMetricsSummaryGrid(s: RenderState): string {
  return `<section class="metrics-summary-shell" aria-label="Cluster metrics summary">
    <div class="metrics-summary-grid">
      ${usageCards(s).map(renderCard).join("")}
    </div>
  </section>`;
}

defineComponent("orbita-metrics-summary-grid", renderMetricsSummaryGrid);
