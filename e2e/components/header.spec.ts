/**
 * Playwright checks for view-specific toolbar controls and search filtering that preserves focus.
 * @module e2e/components/header.spec
 * @category Tests
 */
import { expect, test } from "../fixtures";
import { launch } from "../helpers";

test("orbita-header adapts its controls to the view", async ({ page }) => {
  await launch(page);
  const header = page.locator("orbita-header");
  await expect(header.getByLabel("Namespace")).toBeVisible();
  await page.locator('.nav-item[data-view="nodes"]').click();
  await expect(header.getByLabel("Namespace")).toHaveCount(0);
  await expect(header.locator(".breadcrumb strong")).toHaveText("Nodes");
  await header.getByRole("button", { name: "Toggle light and dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await header.getByLabel("Density").selectOption("compact");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("orbita-header search filters the table and keeps focus", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  const input = page.locator("orbita-header #search-input");
  await input.pressSequentially("api");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("api");
  await expect(page.locator(".resource-page .resource-row").first()).toContainText("api");
});
