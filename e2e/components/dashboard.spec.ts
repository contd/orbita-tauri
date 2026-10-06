import { expect, test } from "@playwright/test";
import { launch } from "../helpers";

test("orbita-dashboard renders metric-card elements that navigate", async ({ page }) => {
  await launch(page);
  await expect(page.locator("orbita-dashboard orbita-metric-grid")).toHaveCount(1);
  await expect(page.locator("orbita-dashboard orbita-metrics-summary-grid")).toHaveCount(1);
  await expect(page.locator("orbita-dashboard orbita-overview-grid")).toHaveCount(1);
  const cards = page.locator("orbita-dashboard orbita-metric-card");
  await expect(cards).toHaveCount(4);
  for (const card of await cards.all()) expect(await card.locator(".metric-card").count()).toBe(1);
  await expect(page.locator("orbita-dashboard .usage-summary-card")).toHaveCount(4);
  await expect(page.locator("orbita-dashboard table")).toHaveCount(0);
  await cards.locator('[data-metric="PODS RUNNING"]').click();
  await expect(page.locator(".resource-page h1")).toHaveText("Pods");
  await expect(page.locator("orbita-dashboard")).toHaveCount(0);
});

test("orbita-metric-card exposes its attributes", async ({ page }) => {
  await launch(page);
  const card = page.locator("orbita-metric-card").first();
  await expect(card).toHaveAttribute("target", "pods");
  await expect(card.locator(".metric-kicker")).toHaveText("PODS RUNNING");
});

test("orbita-overview-grid workload rows and mini stats navigate to matching views", async ({ page }) => {
  await launch(page);
  await page.locator('orbita-overview-grid .workload-link[data-view="deployments"]').click();
  await expect(page.locator(".resource-page h1")).toHaveText("Deployments");

  await page.locator('.sidebar .nav-item[data-view="dashboard"]').click();
  await page.locator('orbita-overview-grid .workload-link[data-view="statefulsets"]').click();
  await expect(page.locator(".resource-page h1")).toHaveText("StatefulSets");

  await page.locator('.sidebar .nav-item[data-view="dashboard"]').click();
  await page.locator('orbita-overview-grid .workload-link[data-view="daemonsets"]').click();
  await expect(page.locator(".resource-page h1")).toHaveText("DaemonSets");

  await page.locator('.sidebar .nav-item[data-view="dashboard"]').click();
  await page.locator("orbita-overview-grid .mini-stats-link").click();
  await expect(page.locator(".resource-page h1")).toHaveText("Pods");
});

test("orbita-dashboard title row shows today's date and a greeting for the local hour", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 11, 25, 15, 0) });
  await launch(page);
  await expect(page.locator("orbita-dashboard .eyebrow")).toContainText("DEC 25, 2026");
  await expect(page.locator("orbita-dashboard h1")).toContainText("Good afternoon");
});
