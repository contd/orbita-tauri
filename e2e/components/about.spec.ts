import { expect, test } from "../fixtures";
import { appPackageInfo, launch } from "../helpers";

test("orbita-about shows metadata read from package.json", async ({ page }) => {
  await launch(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("orbita-menu", { detail: "open-about" })));
  const about = page.locator("orbita-about");
  await expect(about.getByRole("heading", { name: "About Orbita" })).toBeVisible();
  await expect(about).toContainText(appPackageInfo.packageName);
  await expect(about).toContainText(appPackageInfo.version);
  await expect(about).toContainText(appPackageInfo.author);
  await expect(about.getByRole("heading", { name: "Built Using:" })).toBeVisible();
  await expect(about.locator("orbita-logo-tauri svg")).toHaveCount(1);
  await expect(about.locator("orbita-logo-vite svg")).toHaveCount(1);
  await expect(about.locator("orbita-logo-typescript svg")).toHaveCount(1);
  await expect(about.getByRole("link", { name: appPackageInfo.repository })).toBeVisible();
  await expect(about.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:/);
});
