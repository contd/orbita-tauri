import { expect, test } from "@playwright/test";
import { launch } from "../helpers";

test("orbita-about shows metadata read from package.json", async ({ page }) => {
  await launch(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("orbita-menu", { detail: "open-about" })));
  const about = page.locator("orbita-about");
  await expect(about.getByRole("heading", { name: "About Orbita" })).toBeVisible();
  await expect(about).toContainText("orbita-tauri");
  await expect(about).toContainText("0.1.0");
  await expect(about).toContainText("Jason Kumpf");
  await expect(about.getByRole("heading", { name: "Built Using:" })).toBeVisible();
  await expect(about.locator("orbita-logo-tauri svg")).toHaveCount(1);
  await expect(about.locator("orbita-logo-vite svg")).toHaveCount(1);
  await expect(about.locator("orbita-logo-typescript svg")).toHaveCount(1);
  await expect(about.getByRole("link", { name: "https://github.com/contd/orbita-tauri" })).toBeVisible();
  await expect(about.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:/);
});
