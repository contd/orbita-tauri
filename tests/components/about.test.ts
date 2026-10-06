import { describe, expect, test } from "bun:test";
import { renderAbout } from "../../src/components/about";
import { makeState } from "../helpers";

describe("orbita-about", () => {
  test("shows application metadata", () => {
    const html = renderAbout(makeState({ about: { name: "Orbita", packageName: "orbita-tauri", version: "9.9.9", description: "Desc", author: "Me", email: "m@e.x", repository: "https://r.test", keywords: ["k8s", "ui"] } }));
    expect(html).toContain("About Orbita");
    expect(html).toContain("9.9.9");
    expect(html).toContain("https://r.test");
    expect(html).toContain("orbita-tauri");
    expect(html).toContain('href="mailto:m@e.x"');
    expect(html).toContain("k8s, ui");
    expect(html).toContain("Built Using:");
    expect(html).toContain("<orbita-logo-tauri></orbita-logo-tauri>");
    expect(html).toContain("<orbita-logo-vite></orbita-logo-vite>");
    expect(html).toContain("<orbita-logo-typescript></orbita-logo-typescript>");
  });
  test("escapes metadata", () => {
    expect(renderAbout(makeState({ about: { ...makeState().about, name: "<b>" } }))).not.toContain("<b>");
  });
  test("only links http(s) repositories", () => {
    const html = renderAbout(makeState({ about: { ...makeState().about, repository: "javascript:alert(1)" } }));
    expect(html).not.toContain("href=\"javascript");
  });
});
