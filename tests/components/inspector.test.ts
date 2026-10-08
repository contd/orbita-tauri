/**
 * Bun tests for inspector identity, accessibility, manifest cleanup, logs, labels, and events.
 * @module tests/components/inspector.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { demo } from "../../src/kubernetes";
import { renderInspector } from "../../src/components/inspector";
import { makeState } from "../helpers";

const pod = demo.pods[0];

describe("orbita-inspector", () => {
  test("renders nothing when no resource is selected", () => {
    expect(renderInspector(makeState())).toBe("");
  });
  test("is a modal dialog labelled by kind with identity and facts", () => {
    const html = renderInspector(makeState({ view: "pods", inspector: pod }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Pod inspector"');
    expect(html).toContain(pod.metadata.name);
    for (const fact of ["NAMESPACE", "STATUS", "AGE", "LABELS"]) expect(html).toContain(fact);
  });
  test("manifest omits managedFields", () => {
    const withManaged = { ...pod, metadata: { ...pod.metadata, managedFields: [{ manager: "x" }] } };
    expect(renderInspector(makeState({ view: "pods", inspector: withManaged }))).not.toContain("managedFields");
  });
  test("offers logs only for log-capable views", () => {
    expect(renderInspector(makeState({ view: "pods", inspector: pod }))).toContain('data-action="open-logs-inspector"');
    expect(renderInspector(makeState({ view: "services", inspector: demo.services[0] }))).not.toContain("open-logs-inspector");
  });
  test("caps labels at eight and says so", () => {
    const labels = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, "v"]));
    const html = renderInspector(makeState({ view: "pods", inspector: { ...pod, metadata: { ...pod.metadata, labels } } }));
    expect(html).toContain("Showing 8 of 10 labels");
  });
  test("shows the message for events", () => {
    const html = renderInspector(makeState({ view: "events", inspector: demo.events[0] }));
    expect(html).toContain("Event message");
  });
});
