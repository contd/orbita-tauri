/**
 * Bun tests for decorative SVG icons and the fallback used for unknown icon names.
 * @module tests/components/icons.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { icon } from "../../src/components/icons";

describe("icons", () => {
  test("returns a decorative SVG path for known names", () => {
    const svg = icon("close");
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain("m18 6-12 12M6 6l12 12");
  });
  test("falls back to the grid icon for unknown names", () => {
    expect(icon("nope")).toBe(icon("grid"));
  });
});
