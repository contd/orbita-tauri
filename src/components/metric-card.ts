import { escapeHtml, getDef, type ResourceKey } from "../kubernetes";
import { defineElement } from "./base";

/**
 * Renders one dashboard metric card as an actionable button.
 * The card carries a `data-view` target so clicking it navigates to the related resource list.
 */
export function renderMetric(
  label: string,
  value: string,
  detail: string,
  pct: number,
  tone: string,
  symbol: string,
  target: ResourceKey,
): string {
  const percent = Math.round(pct);
  return `
  <button type="button" class="metric-card ${tone}" data-view="${target}" data-metric="${escapeHtml(label)}" aria-label="${escapeHtml(label)}: open ${escapeHtml(getDef(target).label)}">
    <div class="metric-top">
      <span class="metric-icon">${symbol}</span>
      <span class="metric-kicker">${escapeHtml(label)}</span>
      <span class="metric-menu">···</span>
    </div>
    <div class="metric-value">${value}</div>
    <div class="metric-detail">${escapeHtml(detail)}</div>
    <div class="metric-track"><span style="width:${percent}%"></span></div>
    <div class="metric-footer">
      <span>${percent}% of total</span>
      <span class="metric-trend">●&nbsp; Live</span>
    </div>
  </button>`;
}

/** Markup for a metric card; values travel as attributes so the element is self-contained. */
export function metricCardTag(label: string, value: string, detail: string, pct: number, tone: string, symbol: string, target: ResourceKey): string {
  return `<orbita-metric-card label="${escapeHtml(label)}" value="${escapeHtml(value)}" detail="${escapeHtml(detail)}" pct="${pct}" tone="${escapeHtml(tone)}" symbol="${escapeHtml(symbol)}" target="${target}"></orbita-metric-card>`;
}

/** Reads all attributes from the custom element and delegates to {@link renderMetric}. */
defineElement("orbita-metric-card", el =>
  renderMetric(
    el.getAttribute("label") ?? "",
    el.getAttribute("value") ?? "",
    el.getAttribute("detail") ?? "",
    Number(el.getAttribute("pct")),
    el.getAttribute("tone") ?? "",
    el.getAttribute("symbol") ?? "",
    el.getAttribute("target") as ResourceKey,
  ));
