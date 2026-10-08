/**
 * Playwright integration tests for full application workflows using the mock bridge.
 *
 * @remarks
 * Covers demo startup, filtering/sorting, refresh and lazy loading, persisted settings,
 * kubeconfig editing, native menu events, context-bound terminal commands, history,
 * logs, and behavior when CLI tools are unavailable.
 * @module e2e/app.spec
 * @category Tests
 */
import { expect, test } from "./fixtures";
import { definitions, demo } from "../src/kubernetes";
import { appPackageInfo, calls, launch, nav } from "./helpers";

test("launches without kubectl, kubeconfig or cluster in plain demo mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".status-bar")).toContainText("Connected to test-context");
  await expect(page.locator(".metric-card")).toHaveCount(4);
  await expect(page.locator(".cli-status .cli-pill")).toHaveCount(5);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).click();
  await expect(page.locator(".terminal-overlay")).toBeVisible();
});

test("namespace filtering, search, sorting and empty states", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  const all = await page.locator("tbody tr.resource-row").count();
  await page.locator("#namespace-select").selectOption("payments");
  const filtered = await page.locator("tbody tr.resource-row").count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(all);
  await page.locator("#search-input").fill("CHECKOUT");
  await expect(page.locator("tbody tr.resource-row")).toHaveCount(1);
  await page.locator("#search-input").fill("no-such-thing");
  await expect(page.getByText("No resources found")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.locator('[data-sort="Restarts"]').click();
  await expect(page.locator('[data-sort="Restarts"]')).toContainText("↑");
  await page.locator('[data-sort="Restarts"]').click();
  await expect(page.locator('[data-sort="Restarts"]')).toContainText("↓");
});

test("refresh and lazy loading drive navigation counts", async ({ page }) => {
  await launch(page);
  await expect(nav(page, "Pods").locator(".nav-count")).toBeVisible();
  await expect(nav(page, "Jobs").locator(".nav-count")).toHaveCount(0);
  await page.locator('.nav-item[data-view="jobs"]').click();
  await expect(nav(page, "Jobs").locator(".nav-count")).toBeVisible();
  expect((await calls(page)).some(c => c.command === "get_resources" && c.args.kind === "jobs")).toBe(true);
  const before = (await calls(page)).length;
  await page.getByRole("button", { name: "Refresh cluster" }).click();
  await expect.poll(async () => (await calls(page)).length).toBeGreaterThan(before);
});

test("settings opens from toolbar and native menu, saves path, edits and adds kubeconfigs, and persists", async ({ page }) => {
  await launch(page);
  await page.locator(".toolbar-button", { hasText: "Settings" }).click();
  await expect(page.locator("h1")).toHaveText("Settings");
  await page.getByRole("button", { name: "Back to cluster" }).click();
  await expect(page.locator(".metric-card")).toHaveCount(4);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("orbita-menu", { detail: "open-settings" })));
  await expect(page.locator("h1")).toHaveText("Settings");
  await page.locator("#search-path").fill("/tmp/kube");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("#settings-success")).toBeVisible();

  await page.getByRole("button", { name: "Add kubeconfig" }).first().click();
  await page.locator("#new-config-yaml").fill("nonsense");
  await page.getByRole("button", { name: /^(Validate|Add|Save)/ }).last().click();
  await expect(page.locator("#config-error")).not.toBeEmpty();
  await page.locator("#new-config-yaml").fill("apiVersion: v1\nkind: Config\ncontexts:\n  - name: pasted-ctx\n    context:\n      cluster: c\n      user: u");
  await page.locator('[data-action="validate-add-config"]').click();
  await expect(page.locator("#context-select")).toHaveValue("pasted-ctx");
  await expect(page.locator("textarea[data-config]")).toHaveCount(1);
  await page.locator("textarea[data-config]").fill("apiVersion: v1\nkind: Config\ncontexts:\n  - name: renamed-ctx\n    context:\n      cluster: c");
  await page.getByRole("button", { name: "Save kubeconfig" }).click();
  await expect(page.locator("#context-select")).toHaveValue(/renamed-ctx|test-context|other-context/);
  await page.screenshot({ path: "e2e-results/screenshots/settings-saved-kubeconfigs.png" });

  await page.reload();
  await page.locator(".toolbar-button", { hasText: "Settings" }).click();
  await expect(page.locator("#search-path")).toHaveValue("/tmp/kube");
  await expect(page.locator("textarea[data-config]")).toHaveCount(1);
});

test("about view opens from the native menu event", async ({ page }) => {
  await launch(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("orbita-menu", { detail: "open-about" })));
  await expect(page.locator("h1")).toHaveText("About Orbita");
  await expect(page.locator(".about-card")).toContainText(appPackageInfo.version);
  await expect(page.locator(".about-card")).toContainText(appPackageInfo.email);
  await page.getByRole("button", { name: "Back to cluster" }).click();
  await expect(page.locator(".metric-card")).toHaveCount(4);
});

test("kubectl terminal opens from toolbar and status bar and keeps the active view", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="deployments"]').click();
  for (const opener of [page.locator(".topbar").getByRole("button", { name: "Open kubectl terminal" }), page.locator(".status-bar").getByRole("button", { name: /Open kubectl terminal/ })]) {
    await opener.click();
    await expect(page.getByRole("dialog", { name: "Kubectl terminal" })).toBeVisible();
    await page.getByRole("button", { name: "Close terminal" }).click();
    await expect(page.locator("h1")).toHaveText("Deployments");
  }
});

test("terminal sends the selected context, renders output, history, clear, expand and k shortcut", async ({ page }) => {
  await launch(page);
  await page.locator(".status-bar").getByRole("button", { name: /Open kubectl terminal/ }).click();
  const input = page.locator("#terminal-input");
  await input.fill("k");
  await input.press("Tab");
  await expect(input).toHaveValue("kubectl ");
  await input.fill("kubectl get pods -A");
  await input.press("Enter");
  await expect(page.locator("#terminal-output")).toContainText("Process exited with code 0");
  await expect(page.locator("#terminal-output .yaml-key").first()).toBeVisible();
  const run = (await calls(page)).filter(c => c.command === "run_kubectl").pop()!;
  expect(run.args).toEqual({ arguments: ["get", "pods", "-A"], context: "test-context" });
  await expect(page.locator(".history-entry")).toHaveCount(1);
  await input.fill("kubectl get pods --context=evil");
  await input.press("Enter");
  await expect(page.locator("#terminal-output")).toContainText("overrides are not allowed");
  await expect(page.locator(".history-entry")).toHaveCount(2);
  const short = (await page.locator(".terminal-panel").boundingBox())!.height;
  await page.getByRole("button", { name: "Expand panel" }).click();
  expect((await page.locator(".terminal-panel").boundingBox())!.height).toBeGreaterThan(short);
  await page.screenshot({ path: "e2e-results/screenshots/terminal-panel.png" });
  await page.getByRole("button", { name: "Clear output" }).click();
  await expect(page.locator(".output-placeholder")).toBeVisible();
  await page.getByRole("button", { name: "Clear history" }).first().click();
  await expect(page.locator(".history-entry")).toHaveCount(0);
});

test("logs open from the Name action and inspector, node logs aggregate, and closing returns", async ({ page }) => {
  await launch(page);
  await page.locator('.nav-item[data-view="pods"]').click();
  const row = page.locator("tr.resource-row").first();
  await row.hover();
  await row.getByRole("button", { name: /Open logs for/ }).click();
  const drawer = page.getByRole("dialog", { name: /Logs · Pod/ });
  await expect(drawer).toContainText("log line for");
  await expect(drawer).toContainText("<script>alert(1)</script>");
  await expect(drawer.locator("script")).toHaveCount(0);
  await page.screenshot({ path: "e2e-results/screenshots/logs-panel.png" });
  await page.getByRole("button", { name: "Close logs" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("Pods");
  await expect(row.getByRole("button", { name: /Open logs for/ })).toBeFocused();

  await row.click();
  await page.getByRole("button", { name: /Open logs for/ }).last().click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /inspector/ })).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();

  await page.locator('.nav-item[data-view="nodes"]').click();
  await page.locator("tr.resource-row").first().getByRole("button", { name: /Open logs for/ }).click();
  await expect(page.getByRole("dialog", { name: /Logs · Node/ })).toContainText("== platform/worker-1 ==");
  await page.getByRole("button", { name: "Close logs" }).click();

  await page.locator('.nav-item[data-view="services"]').click();
  await expect(page.locator("tr.resource-row").first().getByRole("button", { name: /Open logs for/ })).toHaveCount(0);
});

test("missing kubectl disables only the terminal; missing docker and kind do not", async ({ page }) => {
  await launch(page, { kubectl: false });
  await expect(page.getByLabel("kubectl: Not detected")).toBeVisible();
  await page.locator(".status-bar").getByRole("button", { name: /Open kubectl terminal/ }).click();
  await expect(page.locator(".terminal-overlay")).toContainText("kubectl not detected");
  await expect(page.locator("#terminal-input")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run command" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Clear output" })).toBeDisabled();
  await page.screenshot({ path: "e2e-results/screenshots/terminal-unavailable.png" });
  await page.getByRole("button", { name: "Close terminal" }).click();
  await expect(page.locator('.nav-item[data-view="pods"]')).toBeEnabled();
});

test("docker and kind absence leave the terminal usable", async ({ page }) => {
  await launch(page, { docker: false, kind: false });
  await expect(page.getByLabel("Docker: Not detected")).toBeVisible();
  await page.locator(".status-bar").getByRole("button", { name: /Open kubectl terminal/ }).click();
  await expect(page.locator("#terminal-input")).toBeEnabled();
});
