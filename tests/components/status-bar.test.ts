/**
 * Bun tests for connection/version status, demo markers, CLI indicators, notices, and escaping.
 * @module tests/components/status-bar.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { renderStatusBar } from "../../src/components/status-bar";
import { makeState } from "../helpers";

describe("orbita-status-bar", () => {
  test("shows context, version and demo marker", () => {
    const html = renderStatusBar(makeState());
    expect(html).toContain("<strong>test-context</strong>");
    expect(html).not.toContain("All namespaces");
    expect(html).not.toContain("status-namespace");
    expect(html).toContain("v1.2.3");
    expect(html).toContain("Demo mode");
  });
  test("drops the demo marker when a host is present", () => {
    expect(renderStatusBar(makeState({ bridged: true }))).not.toContain("Demo mode");
  });
  test("embeds the CLI indicators and a terminal button", () => {
    const html = renderStatusBar(makeState());
    expect(html).toContain("<orbita-cli-status></orbita-cli-status>");
    expect(html).toContain('data-action="open-terminal"');
  });
  test("escapes the context name", () => {
    expect(renderStatusBar(makeState({ selectedContext: "<i>" }))).not.toContain("<i>");
  });
  test("shows an escaped, dismissible notice only when one is set", () => {
    const html = renderStatusBar(makeState({ notice: "<script>x" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x");
    expect(html).toContain('data-action="dismiss-notice"');
    expect(renderStatusBar(makeState({ notice: "" }))).not.toContain("dismiss-notice");
  });
});
