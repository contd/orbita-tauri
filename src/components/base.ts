import type { RenderState } from "./types";

/** State read by components when they connect; set by `mount` right before the markup is inserted. */
let current: RenderState | null = null;
export function setCurrentState(s: RenderState): void { current = s; }

const Base: typeof HTMLElement = typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

/** Registers a light-DOM custom element (no shadow root, so the global stylesheet and test selectors still apply). */
export function defineElement(tag: string, render: (el: HTMLElement, s: RenderState) => string): void {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;
  customElements.define(tag, class extends Base {
    connectedCallback(): void { if (current) this.innerHTML = render(this, current); }
  });
}
/** Registers a component whose output depends only on application state. */
export function defineComponent(tag: string, render: (s: RenderState) => string): void {
  defineElement(tag, (_el, s) => render(s));
}
