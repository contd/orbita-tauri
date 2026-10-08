/**
 * Playwright checks for navigation, group folding, context switching, and the Add kubeconfig action.
 *
 * @remarks
 * Also verifies collapse to an icon rail, increased page width, and persisted collapse state.
 * @module e2e/components/sidebar.spec
 * @category Tests
 */
import { expect, test } from "../fixtures";
import { launch } from "../helpers";

test("orbita-sidebar navigates, folds groups and switches context", async ({ page }) => {
  await launch(page);
  const sidebar = page.locator("orbita-sidebar");
  await sidebar.locator('.nav-item[data-view="pods"]').click();
  await expect(sidebar.locator('.nav-item[data-view="pods"]')).toHaveClass(/active/);
  await expect(page.locator(".resource-page")).toBeVisible();
  const heading = sidebar.locator('[data-group="Workloads"]');
  await heading.click();
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar.locator('.nav-item[data-view="deployments"]')).toHaveCount(0);
  await sidebar.locator("#context-select").selectOption("other-context");
  await expect(page.locator("orbita-status-bar")).toContainText("other-context");
});

test("orbita-sidebar cluster card has Add kubeconfig and opens the dialog", async ({ page }) => {
  await launch(page);
  await page.locator(".cluster-card").getByRole("button", { name: /Add kubeconfig/ }).click();
  await expect(page.locator("orbita-dialog").getByRole("dialog")).toBeVisible();
  await expect(page.locator(".nav-scroll .nav-add-config")).toHaveCount(0);
});

test("orbita-sidebar collapses to an icon rail, the page expands, and the choice persists", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await launch(page);
  const sidebar = page.locator(".sidebar");
  const main = page.locator(".main-area");
  const expandedWidth = (await sidebar.boundingBox())!.width;
  const mainBefore = (await main.boundingBox())!.width;
  const toggle = page.getByRole("button", { name: "Collapse sidebar" });
  const [sb, tb] = [(await sidebar.boundingBox())!, (await toggle.boundingBox())!];
  expect(tb.x + tb.width).toBeGreaterThan(sb.x + sb.width - 16);
  expect(tb.y).toBeLessThan(sb.y + 16);
  await toggle.click();
  await expect(page.locator(".nav-label").first()).toBeHidden();
  expect((await sidebar.boundingBox())!.width).toBeLessThan(expandedWidth / 2);
  expect((await main.boundingBox())!.width).toBeGreaterThan(mainBefore);
  await page.getByRole("button", { name: "Pods", exact: true }).click();
  await expect(page.locator(".resource-page h1")).toHaveText("Pods");
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".nav-label").first()).toBeVisible();
});
