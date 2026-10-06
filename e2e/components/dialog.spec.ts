import { expect, test } from "@playwright/test";
import { launch } from "../helpers";

test("orbita-dialog validates a pasted kubeconfig and closes", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: /Add kubeconfig/ }).first().click();
  const dialog = page.locator("orbita-dialog");
  await expect(dialog.getByRole("dialog")).toBeVisible();
  await dialog.locator("#new-config-yaml").fill("not a kubeconfig");
  await dialog.locator('[data-action="validate-add-config"]').click();
  await expect(dialog.locator("#config-error")).toContainText("valid kubeconfig");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeEmpty();
});

test("orbita-dialog adds a valid kubeconfig's context", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: /Add kubeconfig/ }).first().click();
  await page.locator("#new-config-yaml").fill("apiVersion: v1\nkind: Config\ncontexts:\n  - name: dlg-ctx\n    context:\n      cluster: c");
  await page.locator('[data-action="validate-add-config"]').click();
  await expect(page.locator("orbita-dialog")).toBeEmpty();
  await expect(page.locator("#context-select")).toHaveValue("dlg-ctx");
});
