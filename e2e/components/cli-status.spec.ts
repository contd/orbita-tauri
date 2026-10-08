/**
 * Playwright checks for CLI availability indicators, tooltips, Windows WSL state,
 * and visible login-shell startup errors.
 * @module e2e/components/cli-status.spec
 * @category Tests
 */
import { expect, test } from "../fixtures";
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

test("startup reports login-shell environment errors instead of hiding detection failures", async ({ page }) => {
  await launch(page);
  await page.addInitScript(() => {
    const host = window as typeof window & {
      __ORBITA_BRIDGE__: (command: string, args?: unknown) => Promise<unknown>;
    };
    const bridge = host.__ORBITA_BRIDGE__;
    host.__ORBITA_BRIDGE__ = async (command, args) => {
      if (command === "check_cli_tools" || command === "get_contexts") {
        throw new Error("Reading the login-shell environment timed out.");
      }
      return bridge(command, args);
    };
  });
  await page.reload();
  await expect(page.locator(".status-bar")).toContainText("Reading the login-shell environment timed out.");
  await expect(page.locator("orbita-cli-status").getByLabel("kubectl: Not detected")).toBeVisible();
});
