import { expect, test } from "../fixtures";
import { launch } from "../helpers";

test("orbita-logs opens from a row action, escapes content, and returns focus on close", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  const opener = page.locator(".resource-page .resource-row").first().getByRole("button", { name: /Open logs for/ });
  await opener.click({ force: true });
  const logs = page.locator("orbita-logs");
  await expect(logs.getByRole("dialog", { name: /Logs · Pod/ })).toBeVisible();
  await expect(logs.locator(".logs-output")).toContainText("<script>alert(1)</script>");
  await expect(logs.locator(".logs-output script")).toHaveCount(0);
  await logs.getByRole("button", { name: "Close logs" }).click();
  await expect(logs).toBeEmpty();
  await expect(opener).toBeFocused();
});
