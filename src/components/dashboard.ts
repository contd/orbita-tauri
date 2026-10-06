import { defineComponent } from "./base";
import type { RenderState } from "./types";

/**
 * Chooses a greeting from the local hour: morning before 12:00, afternoon before 18:00, otherwise evening.
 * @param date - Moment to describe, in the user's local time zone; defaults to now.
 */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/**
 * Formats a date as an upper-case eyebrow label such as `OCT 05, 2026`, in the user's locale and time zone.
 * @param date - Moment to format; defaults to now.
 */
export function eyebrowDate(date: Date = new Date()): string {
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`.toUpperCase();
}

export function renderDashboard(_s: RenderState, now: Date = new Date()): string {
  return `<div class="page-content dashboard-page">
    <div class="page-title-row">
      <div><div class="eyebrow">OVERVIEW <span>·</span> ${eyebrowDate(now)}</div><h1>${greeting(now)} <span class="wave">✦</span></h1><p class="page-subtitle">Here's what's happening across your cluster today.</p></div>
      <div class="page-title-actions"><div class="live-indicator"><span></span>Live data</div></div>
    </div>
    <orbita-metric-grid></orbita-metric-grid>
    <orbita-overview-grid></orbita-overview-grid>
  </div>`;
}

defineComponent("orbita-dashboard", renderDashboard);
