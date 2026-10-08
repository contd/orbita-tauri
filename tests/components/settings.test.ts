/**
 * Bun tests for search paths, saved kubeconfigs, appearance choices, save feedback, and CLI paths.
 * @module tests/components/settings.test
 * @category Tests
 */
import { describe, expect, test } from "bun:test";
import { renderSettings } from "../../src/components/settings";
import { makeState } from "../helpers";

describe("orbita-settings", () => {
  test("shows the search path, appearance and CLI sections", () => {
    const html = renderSettings(makeState());
    expect(html).toContain('id="search-path" value="~/.kube"');
    expect(html).toContain("Back to cluster");
    expect(html).toContain("No saved kubeconfigs");
    expect(html).toContain("Executable not found on PATH");
  });
  test("lists saved kubeconfigs with editable, escaped YAML", () => {
    const settings = { ...makeState().settings, savedConfigs: [{ id: "c1", name: "<n>", yaml: "a: <b>" }] };
    const html = renderSettings(makeState({ settings }));
    expect(html).toContain('data-config="c1"');
    expect(html).toContain('data-action="remove-config" data-id="c1"');
    expect(html).not.toContain("<n>");
    expect(html).not.toContain("a: <b>");
  });
  test("saved confirmation only after saving", () => {
    expect(renderSettings(makeState())).not.toContain("settings-success");
    expect(renderSettings(makeState({ settingsSaved: true }))).toContain("settings-success");
  });
  test("selected theme and density are marked", () => {
    const html = renderSettings(makeState({ settings: { ...makeState().settings, theme: "light", density: "compact" } }));
    expect(html).toContain('data-theme="light" class="selected"');
    expect(html).toContain('<option value="compact" selected>');
  });
  test("shows detected tool paths", () => {
    const html = renderSettings(makeState({ cliPaths: { kubectl: "/usr/bin/kubectl" } }));
    expect(html).toContain("/usr/bin/kubectl");
  });
});
