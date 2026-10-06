import { describe, expect, test } from "bun:test";
import { renderCli } from "../../src/components/cli-status";
import { makeState } from "../helpers";

describe("orbita-cli-status", () => {
  test("shows a pill per configured tool with detection state", () => {
    const html = renderCli(makeState());
    expect(html).toContain('aria-label="kubectl: Detected"');
    expect(html).toContain('aria-label="Docker: Detected"');
    expect(html).toContain('aria-label="kind: Not detected"');
    expect(html).toContain('aria-label="aws: Not detected"');
    expect(html).toContain('aria-label="bash: Detected"');
    expect(html).not.toContain('aria-label="WSL:');
  });
  test("shows checking state before detection finishes", () => {
    const html = renderCli(makeState({ cliChecking: true }));
    expect(html.match(/Checking availability/g)!.length).toBe(15);
  });
  test("tooltip repeats the state and detected dot is marked up", () => {
    const html = renderCli(makeState());
    expect(html).toContain('<span class="cli-tooltip" role="tooltip">Detected</span>');
    expect(html.match(/cli-dot up/g)).toHaveLength(3);
  });
  test("windows hosts add a WSL indicator", () => {
    const html = renderCli(makeState({ cli: { ...makeState().cli, hostWindows: true, wsl: true } }));
    expect(html).toContain('aria-label="WSL: Detected"');
  });
});
