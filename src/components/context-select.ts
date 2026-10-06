import { escapeHtml } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { ContextOption, ContextOptionStyle, RenderState } from "./types";

const defaultStyle: ContextOptionStyle = {
  accent: "#7aa2ff",
  border: "#425a78",
  background: "#141d29",
  text: "#d7e6ff",
};

/** Fallback when no context style metadata is supplied. */
function defaultOption(value: string): ContextOption {
  return { value, label: value, style: defaultStyle };
}

/** Inline CSS variables derived from the selected option style. */
function cssVars(style: ContextOptionStyle): string {
  return [
    `--context-accent:${escapeHtml(style.accent)}`,
    `--context-border:${escapeHtml(style.border)}`,
    `--context-surface:${escapeHtml(style.background)}`,
    `--context-text:${escapeHtml(style.text)}`,
  ].join(";");
}

/** One native option element carrying style metadata in data attributes. */
function renderOption(option: ContextOption, selected: boolean): string {
  const style = option.style ?? defaultStyle;
  return `<option value="${escapeHtml(option.value)}" ${selected ? "selected" : ""} data-accent="${escapeHtml(style.accent)}" data-border="${escapeHtml(style.border)}" data-background="${escapeHtml(style.background)}" data-text="${escapeHtml(style.text)}">${escapeHtml(option.label)}</option>`;
}

/** Stylized context selector shown inside the sidebar cluster card. */
export function renderContextSelect(s: RenderState): string {
  const options = (s.contextOptions.length ? s.contextOptions : s.contextNames.map(defaultOption))
    .map(option => ({ ...option, style: option.style ?? defaultStyle }));
  const selected = options.find(option => option.value === s.selectedContext) ?? options[0] ?? defaultOption("");
  return `<div class="context-select-wrap" style="${cssVars(selected.style)}">
    <span class="context-select-caption">
      <span class="context-select-dot"></span>
      Current context
    </span>
    <span class="context-select-input">
      <select id="context-select" aria-label="Current context">${options.map(option => renderOption(option, option.value === selected.value)).join("")}
      </select>
      <span class="context-select-chevron">${icon("chevron")}</span>
    </span>
  </div>`;
}

defineComponent("orbita-context-select", renderContextSelect);
