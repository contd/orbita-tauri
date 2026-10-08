/**
 * Playwright checks for row inspectors, log actions, Escape/backdrop dismissal, and non-log views.
 * @module e2e/components/inspector.spec
 * @category Tests
 */
import { expect, test } from "../fixtures";
import { launch } from "../helpers";

test("orbita-inspector opens from a row, offers logs, and closes with Escape", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  await page.locator(".resource-page .resource-row").first().click();
  const inspector = page.locator("orbita-inspector");
  await expect(inspector.getByRole("dialog", { name: "Pod inspector" })).toBeVisible();
  await expect(inspector.locator(".yaml-manifest")).not.toContainText("managedFields");
  await expect(inspector.getByRole("button", { name: /Open logs for/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inspector).toBeEmpty();
});

test("orbita-inspector closes from the backdrop and is absent for non-log kinds' log button", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="services"]').click();
  await page.locator(".resource-page .resource-row").first().click();
  await expect(page.locator("orbita-inspector").getByRole("button", { name: /Open logs for/ })).toHaveCount(0);
  await page.locator("orbita-inspector .inspector-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("orbita-inspector")).toBeEmpty();
});
