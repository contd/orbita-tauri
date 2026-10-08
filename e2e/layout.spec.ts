/**
 * Playwright layout matrix for status-bar placement across densities and views.
 *
 * @remarks
 * Verifies bottom pinning at compact, normal, and cozy density on dashboard and
 * pod views at a fixed 1200 by 600 viewport.
 * @module e2e/layout.spec
 * @category Tests
 */
import { expect, test } from "./fixtures";
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
