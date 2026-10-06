import { describe, expect, test } from "bun:test";
import { renderDialog } from "../../src/components/dialog";
import { makeState } from "../helpers";

describe("orbita-dialog", () => {
  test("renders nothing while closed", () => {
    expect(renderDialog(makeState())).toBe("");
  });
  test("add-kubeconfig dialog is an accessible modal form", () => {
    const html = renderDialog(makeState({ dialog: "add-config" }));
    expect(html).toContain('role="dialog" aria-modal="true" aria-labelledby="dialog-title"');
    for (const id of ["new-config-name", "new-config-yaml", "config-error"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('data-action="validate-add-config"');
    expect(html).toContain('role="alert"');
  });
  test("can be dismissed with close and cancel actions", () => {
    expect(renderDialog(makeState({ dialog: "add-config" })).match(/data-action="close-dialog"/g)).toHaveLength(2);
  });
});
