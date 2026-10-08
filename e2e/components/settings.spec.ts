/**
 * Playwright checks for search-path validation/saving, returning to the cluster, and theme changes.
 * @module e2e/components/settings.spec
 * @category Tests
 */
import { expect, test } from "../fixtures";
import { launch } from "../helpers";

test("orbita-settings validates and saves the search path, and goes back", async ({ page }) => {
  await launch(page);
  await page.locator(".sidebar-bottom [data-view=settings]").click();
  const settings = page.locator("orbita-settings");
  await expect(settings.getByRole("heading", { name: "Settings" })).toBeVisible();
  await settings.locator("#search-path").fill("");
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.locator("#settings-success")).toHaveCount(0);
  await settings.locator("#search-path").fill("/tmp/kube");
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.locator("#settings-success")).toBeVisible();
  await settings.getByRole("button", { name: "Back to cluster" }).click();
  await expect(page.locator("orbita-dashboard")).toHaveCount(1);
});

test("orbita-settings theme buttons switch the theme", async ({ page }) => {
  await launch(page);
  await page.locator(".sidebar-bottom [data-view=settings]").click();
  await page.locator('orbita-settings [data-theme="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('orbita-settings [data-theme="light"]')).toHaveClass(/selected/);
});
