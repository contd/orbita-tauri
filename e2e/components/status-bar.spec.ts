/**
 * Playwright checks for connection/version text, dismissible notices, and opening the terminal.
 * @module e2e/components/status-bar.spec
 * @category Tests
 */
import { expect, test } from "../fixtures";
import { appPackageInfo, launch } from "../helpers";

test("orbita-status-bar shows connection, notice and version, and opens the terminal", async ({ page }) => {
  await launch(page);
  const bar = page.locator("orbita-status-bar");
  await expect(bar).toContainText("Connected to test-context");
  await expect(bar).not.toContainText("All namespaces");
  await expect(bar.locator(".status-notice")).toContainText("Live cluster data");
  await expect(page.locator("orbita-dashboard .notice")).toHaveCount(0);
  await bar.getByRole("button", { name: "Dismiss notice" }).click();
  await expect(bar.locator(".status-notice")).toHaveCount(0);
  await expect(bar).toContainText(`${appPackageInfo.name} v${appPackageInfo.version}`);
  await expect(bar).not.toContainText("Demo mode");
  await bar.getByRole("button", { name: /Open kubectl terminal/ }).click();
  await expect(page.locator("orbita-terminal [role=dialog]")).toBeVisible();
});
