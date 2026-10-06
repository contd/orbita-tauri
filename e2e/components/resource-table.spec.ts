import { expect, test } from "@playwright/test";
import { launch } from "../helpers";

test("orbita-resource-table sorts, filters and opens rows", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  const table = page.locator(".resource-page");
  const names = () => table.locator(".resource-row .name-cell strong").allTextContents();
  const asc = await names();
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  await table.locator('[data-sort="Name"]').click();
  expect(await names()).toEqual([...asc].reverse());
  await table.locator(".resource-row").first().click();
  await expect(page.locator("orbita-inspector [role=dialog]")).toBeVisible();
});

test("orbita-resource-table shows an empty state that can be cleared", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  await page.locator("#search-input").fill("zzz-none");
  await expect(page.locator(".resource-page")).toContainText("No resources found");
  await page.locator(".resource-page").getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".resource-page .resource-row").first()).toBeVisible();
});

test("orbita-resource-table columns are draggable", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  const table = page.locator(".resource-page table.resource-table-grid");
  const firstHeader = table.locator("thead th").nth(0);
  const secondHeader = table.locator("thead th").nth(1);
  const firstWidth = async () => (await firstHeader.boundingBox())!.width;
  const secondWidth = async () => (await secondHeader.boundingBox())!.width;
  const startFirst = await firstWidth();
  const startSecond = await secondWidth();
  const handle = table.locator('.table-col-resizer[data-column-index="0"]');
  const drag = (await handle.boundingBox())!;
  const y = drag.y + drag.height / 2;
  await page.mouse.move(drag.x + drag.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(drag.x + 80, y);
  await page.mouse.up();
  await expect.poll(firstWidth).toBeGreaterThan(startFirst + 24);
  await expect.poll(secondWidth).toBeLessThan(startSecond - 16);
});
