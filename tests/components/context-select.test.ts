import { describe, expect, test } from "bun:test";
import { renderContextSelect } from "../../src/components/context-select";
import { makeState } from "../helpers";

describe("orbita-context-select", () => {
  test("renders options, escapes labels and marks the selected context", () => {
    const html = renderContextSelect(makeState({
      selectedContext: "prod",
      contextOptions: [
        { value: "prod", label: "Production", style: { accent: "#f80", border: "#531", background: "#210", text: "#ffd8c2" } },
        { value: "x", label: "<unsafe>", style: { accent: "#7aa", border: "#355", background: "#123", text: "#def" } },
      ],
    }));
    expect(html).toContain('id="context-select"');
    expect(html).toContain('<option value="prod" selected');
    expect(html).toContain("&lt;unsafe&gt;");
    expect(html).toContain("data-accent=\"#f80\"");
  });

  test("uses context names as fallback options when explicit options are missing", () => {
    const html = renderContextSelect(makeState({
      contextNames: ["a", "b"],
      contextOptions: [],
      selectedContext: "a",
    }));
    expect(html).toContain('<option value="a" selected');
    expect(html).toContain('<option value="b" ');
  });
});
