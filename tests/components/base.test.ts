import { afterEach, describe, expect, test } from "bun:test";
import { defineComponent, defineElement, setCurrentState } from "../../src/components/base";
import { makeState } from "../helpers";

const g = globalThis as any;
afterEach(() => { delete g.customElements; });

/** Minimal customElements stand-in recording definitions. */
function fakeRegistry() {
  const defined = new Map<string, any>();
  g.customElements = { get: (t: string) => defined.get(t), define: (t: string, c: any) => defined.set(t, c) };
  return defined;
}

describe("component base", () => {
  test("does nothing without a custom element registry", () => {
    expect(() => defineComponent("orbita-x", () => "")).not.toThrow();
  });
  test("registers each tag once", () => {
    const defined = fakeRegistry();
    defineComponent("orbita-once", () => "a");
    defineComponent("orbita-once", () => "b");
    expect(defined.size).toBe(1);
  });
  test("connected elements render from the current state", () => {
    const defined = fakeRegistry();
    defineComponent("orbita-state", s => `ctx:${s.selectedContext}`);
    setCurrentState(makeState({ selectedContext: "prod" }));
    const el = new (defined.get("orbita-state"))();
    el.connectedCallback();
    expect(el.innerHTML).toBe("ctx:prod");
  });
  test("defineElement passes the element itself to the renderer", () => {
    const defined = fakeRegistry();
    defineElement("orbita-el", el => `has:${typeof el.getAttribute}`);
    setCurrentState(makeState());
    const el: any = new (defined.get("orbita-el"))();
    el.getAttribute = () => null;
    el.connectedCallback();
    expect(el.innerHTML).toBe("has:function");
  });
});
