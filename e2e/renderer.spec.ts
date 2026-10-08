import { expect, test } from "./fixtures";
import { definitions, demo } from "../src/kubernetes";
import { calls, launch, nav } from "./helpers";

test("shows connected state and every CLI indicator", async ({ page }) => {
  await launch(page);
  for (const tool of ["kubectl", "Docker", "kind"]) await expect(page.getByLabel(`${tool}: Detected`)).toBeVisible();
  await page.getByLabel("Docker: Detected").hover();
  await expect(page.locator('[data-cli="docker"] .cli-tooltip')).toHaveText("Detected");
});

test("dashboard cards render without a table and navigate to their views", async ({ page }) => {
  await launch(page);
  await expect(page.locator("table")).toHaveCount(0);
  const targets: [string, string][] = [["PODS RUNNING", "Pods"], ["NODES READY", "Nodes"], ["WORKLOADS READY", "DaemonSets"], ["WARNINGS", "Events"]];
  for (const [card, heading] of targets) {
    await page.locator(`[data-metric="${card}"]`).click();
    await expect(page.locator("h1")).toHaveText(heading);
    await nav(page, "Dashboard").click();
  }
});

test.describe("every resource view", () => {
  for (const def of definitions) {
    test(`${def.label} opens with columns and rows`, async ({ page }) => {
      await launch(page);
      await page.locator(`.nav-item[data-view="${def.key}"]`).click();
      await expect(page.locator("h1")).toHaveText(def.label);
      await expect(page.locator("tbody tr.resource-row").first()).toBeVisible();
      const headers = await page.locator("thead th .sort-button").allTextContents();
      expect(headers.map(h => h.replace(/[↑↓]/g, "").trim())).toEqual(["Name", ...def.columns.map(c => c.label)]);
      await page.screenshot({ path: `e2e-results/screenshots/view-${def.key}.png` });
    });
  }
});

test("navigation groups collapse with aria-expanded", async ({ page }) => {
  await launch(page);
  const toggle = page.getByRole("button", { name: "Workloads", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("inspector opens, shows manifest without managedFields, and closes", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="events"]').click();
  await page.locator("tbody tr.resource-row").first().click();
  const inspector = page.getByRole("dialog", { name: /inspector/ });
  await expect(inspector).toBeVisible();
  await expect(inspector.locator(".yaml-manifest")).not.toContainText("managedFields");
  await expect(inspector.getByRole("button", { name: "Copy resource name" }).first()).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Copy manifest" })).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(inspector).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("Events");
});

test("theme and density controls update state and layout", async ({ page }) => {
  await launch(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Toggle light and dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "e2e-results/screenshots/dashboard-light.png" });
  await page.getByRole("button", { name: "Toggle light and dark theme" }).click();
  await page.screenshot({ path: "e2e-results/screenshots/dashboard-dark.png" });
  await page.locator('.nav-item[data-view="pods"]').click();
  const rowHeight = async () => (await page.locator("tbody tr.resource-row").first().boundingBox())!.height;
  const normal = await rowHeight();
  await page.getByLabel("Density").selectOption("compact");
  await expect(html).toHaveAttribute("data-density", "compact");
  expect(await rowHeight()).toBeLessThan(normal);
  await page.reload();
  await expect(html).toHaveAttribute("data-density", "compact");
});

test("layout fills the window width", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await launch(page);
  const box = (await page.locator(".page-content").boundingBox())!;
  expect(box.x + box.width).toBeGreaterThan(1900 * 0.95);
});
