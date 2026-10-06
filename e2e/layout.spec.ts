import { expect, test } from "@playwright/test";
import { launch } from "./helpers";

for (const density of ["compact", "normal", "cozy"]) {
  for (const view of ["dashboard", "pods"]) {
    test(`status bar is pinned to the window bottom (${density}, ${view})`, async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 600 });
      await launch(page);
      await page.evaluate(d => document.documentElement.setAttribute("data-density", d), density);
      await page.locator(`.nav-item[data-view="${view}"]`).click();
      const bottom = await page.locator(".status-bar").evaluate(e => e.getBoundingClientRect().bottom);
      expect(Math.round(bottom)).toBe(600);
    });
  }
}
