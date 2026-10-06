import { expect, test } from "@playwright/test";
import { launch } from "../helpers";

test("orbita-cli-status reflects detection and shows tooltips", async ({ page }) => {
  await launch(page, { docker: false });
  const cli = page.locator("orbita-cli-status");
  await expect(cli.getByLabel("kubectl: Detected")).toBeVisible();
  await expect(cli.getByLabel("Docker: Not detected")).toBeVisible();
  await expect(cli.getByLabel("aws: Detected")).toBeVisible();
  await expect(cli.getByLabel("bash: Detected")).toBeVisible();
  await cli.getByLabel("Docker: Not detected").hover();
  await expect(cli.locator('[data-cli="docker"] .cli-tooltip')).toBeVisible();
});

test("orbita-cli-status shows WSL on windows hosts", async ({ page }) => {
  await launch(page, { windows: true, wsl: false, bash: false });
  const cli = page.locator("orbita-cli-status");
  await expect(cli.getByLabel("WSL: Not detected")).toBeVisible();
  await expect(cli.getByLabel("bash: Not detected")).toBeVisible();
});
