import { expect, test } from "@playwright/test";
import { launch } from "../helpers";

/** Every component must be a registered custom element that rendered its own content. */
test("all shell components are registered and render content", async ({ page }) => {
  await launch(page);
  for (const tag of ["orbita-sidebar", "orbita-header", "orbita-dashboard", "orbita-status-bar", "orbita-cli-status"]) {
    await expect(page.locator(tag)).toHaveCount(1);
    expect(await page.locator(tag).evaluate(el => el.childElementCount)).toBeGreaterThan(0);
    expect(await page.evaluate(t => Boolean(customElements.get(t)), tag)).toBe(true);
  }
  for (const tag of ["orbita-inspector", "orbita-dialog", "orbita-terminal", "orbita-logs"]) {
    await expect(page.locator(tag)).toHaveCount(1);
    await expect(page.locator(tag)).toBeEmpty();
  }
});

test("wrapper elements do not affect layout", async ({ page }) => {
  await launch(page);
  for (const tag of ["orbita-sidebar", "orbita-dashboard", "orbita-status-bar"]) {
    await expect(page.locator(tag)).toHaveCSS("display", "contents");
  }
});
