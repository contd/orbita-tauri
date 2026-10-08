import { expect, test } from "../fixtures";
import { calls, launch } from "../helpers";

test("orbita-terminal runs a command, records history and closes", async ({ page }) => {
  await launch(page);
  await page.locator("orbita-header").getByRole("button", { name: "Open kubectl terminal" }).click();
  const term = page.locator("orbita-terminal");
  await expect(term.getByRole("dialog", { name: "Kubectl terminal" })).toBeVisible();
  await term.locator("#terminal-input").fill("kubectl get pods");
  await term.getByRole("button", { name: "Run command" }).click();
  await expect(term.locator("#terminal-output")).toContainText("Process exited with code 0");
  await expect(term.locator(".history-entry")).toHaveCount(1);
  expect((await calls(page)).filter(c => c.command === "run_kubectl")[0].args.arguments).toEqual(["get", "pods"]);
  await term.getByRole("button", { name: "Close terminal" }).click();
  await expect(term).toBeEmpty();
});

test("orbita-terminal rejects context overrides without calling the host", async ({ page }) => {
  await launch(page);
  await page.locator("orbita-header").getByRole("button", { name: "Open kubectl terminal" }).click();
  await page.locator("#terminal-input").fill("kubectl get pods --context other");
  await page.getByRole("button", { name: "Run command" }).click();
  await expect(page.locator(".terminal-stderr")).toContainText("not allowed");
  expect((await calls(page)).filter(c => c.command === "run_kubectl")).toHaveLength(0);
});

test("orbita-terminal is disabled when kubectl is missing", async ({ page }) => {
  await launch(page, { kubectl: false });
  await page.locator("orbita-header").getByRole("button", { name: "Open kubectl terminal" }).click();
  await expect(page.locator("orbita-terminal .terminal-overlay")).toBeVisible();
  await expect(page.locator("#terminal-input")).toBeDisabled();
});

test("orbita-terminal rises from the status bar at the same width", async ({ page }) => {
  await launch(page);
  await page.locator(".status-bar").getByRole("button", { name: /Open kubectl terminal/ }).click();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const panel = (await page.locator("orbita-terminal .terminal-panel").boundingBox())!;
  const bar = (await page.locator(".status-bar").boundingBox())!;
  expect(Math.abs(panel.x - bar.x)).toBeLessThan(1);
  expect(Math.abs(panel.width - bar.width)).toBeLessThan(1);
  expect(Math.abs(panel.y + panel.height - bar.y)).toBeLessThan(1.5);
  await expect(page.locator(".status-bar")).toBeVisible();
});

test("orbita-terminal covers about two thirds of the page height", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const panel = (await page.locator("orbita-terminal .terminal-panel").boundingBox())!;
  const main = (await page.locator(".main-area").boundingBox())!;
  expect(panel.height / main.height).toBeGreaterThan(0.6);
  expect(panel.height / main.height).toBeLessThan(0.72);
});

test("orbita-terminal Enter runs the command instead of adding a line", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  await page.locator("#terminal-input").fill("kubectl get nodes");
  await page.locator("#terminal-input").press("Enter");
  await expect(page.locator("#terminal-output")).toContainText("Process exited with code 0");
  await expect(page.locator("#terminal-input")).toHaveValue("");
});

test("orbita-terminal expands 'k ' and 'kub' to 'kubectl ' while typing", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const box = page.locator("#terminal-input");
  await box.pressSequentially("k ");
  await expect(box).toHaveValue("kubectl ");
  await box.fill("");
  await box.pressSequentially("kub");
  await expect(box).toHaveValue("kubectl ");
  await box.pressSequentially("get pods");
  await expect(box).toHaveValue("kubectl get pods");
});

test("orbita-terminal does not re-expand when deleting back to 'kub'", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const box = page.locator("#terminal-input");
  await box.pressSequentially("kub");
  for (let i = 0; i < 5; i++) await box.press("Backspace");
  await expect(box).toHaveValue("kub");
  await box.fill("get k ");
  await expect(box).toHaveValue("get k ");
});

test("orbita-terminal ignores Escape and backdrop clicks and closes only with its button", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const term = page.locator("orbita-terminal");
  await page.keyboard.press("Escape");
  await expect(term.getByRole("dialog")).toBeVisible();
  await term.locator(".terminal-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(term.getByRole("dialog")).toBeVisible();
  await term.getByRole("button", { name: "Close terminal" }).click();
  await expect(term).toBeEmpty();
});

/** Re-renders the whole app without touching focus, as a background data refresh does. */
const backgroundRender = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.dispatchEvent(new CustomEvent("orbita-menu", { detail: "open-about" })));

test("orbita-terminal keeps focus, text and caret across background re-renders", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const box = page.locator("#terminal-input");
  await box.fill("kubectl get pods");
  await box.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(8, 8));
  await backgroundRender(page);
  await expect(page.locator("orbita-about")).toBeVisible();
  await expect(box).toBeFocused();
  await box.pressSequentially("X");
  await expect(box).toHaveValue("kubectl Xget pods");
});

test("orbita-terminal does not replay its rise animation on re-render", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  await page.waitForFunction(() => document.getAnimations().length === 0);
  await page.locator("#terminal-input").pressSequentially("k");
  await backgroundRender(page);
  await expect(page.locator("orbita-about")).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator("#terminal-input")).toBeFocused();
});

test("orbita-terminal format toggle re-runs the last command as JSON and back to text", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const term = page.locator("orbita-terminal");
  const runs = async () => (await calls(page)).filter(c => c.command === "run_kubectl").map(c => c.args.arguments);
  await term.locator("#terminal-input").fill("kubectl get pods -o wide");
  await term.locator("#terminal-input").press("Enter");
  await expect(term.locator("#terminal-output")).toContainText("Process exited with code 0");
  expect((await runs())[0]).toEqual(["get", "pods", "-o", "wide"]);
  const toggle = term.getByRole("button", { name: /Output format/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toContainText("TEXT");
  await expect(toggle).toContainText("JSON");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await runs()).length).toBe(2);
  expect((await runs())[1]).toEqual(["get", "pods", "-o", "json"]);
  await expect(term.locator("#terminal-output .json-key").first()).toBeVisible();
  await expect(term.locator("#terminal-output .json-string").first()).toBeVisible();
  await expect(term.locator(".history-entry")).toHaveCount(1);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await runs()).length).toBe(3);
  expect((await runs())[2]).toEqual(["get", "pods", "-o", "wide"]);
  await expect(term.locator("#terminal-output .yaml-key").first()).toBeVisible();
});

test("orbita-terminal format applies to the next command when nothing has run yet", async ({ page }) => {
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const term = page.locator("orbita-terminal");
  await term.getByRole("button", { name: /Output format/ }).click();
  expect((await calls(page)).filter(c => c.command === "run_kubectl")).toHaveLength(0);
  await term.locator("#terminal-input").fill("kubectl get nodes");
  await term.locator("#terminal-input").press("Enter");
  await expect.poll(async () => (await calls(page)).filter(c => c.command === "run_kubectl").length).toBe(1);
  expect((await calls(page)).filter(c => c.command === "run_kubectl")[0].args.arguments).toEqual(["get", "nodes", "-o", "json"]);
});

test("orbita-terminal output is wide by default and the toggle switches the panel to full height", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const panel = page.locator("orbita-terminal .terminal-panel");
  const widthShare = async () => (await page.locator(".terminal-output-pane").boundingBox())!.width / (await page.locator(".terminal-body").boundingBox())!.width;
  expect(await widthShare()).toBeGreaterThan(0.8);
  const main = (await page.locator(".main-area").boundingBox())!;
  const status = (await page.locator(".status-bar").boundingBox())!;
  expect((await panel.boundingBox())!.height / main.height).toBeLessThan(0.72);
  await page.getByRole("button", { name: "Expand panel" }).click();
  const full = (await panel.boundingBox())!;
  expect(Math.abs(full.y - main.y)).toBeLessThan(1.5);
  expect(Math.abs(full.y + full.height - status.y)).toBeLessThan(1.5);
  expect(await widthShare()).toBeGreaterThan(0.8);
  await page.getByRole("button", { name: "Collapse panel" }).click();
  expect((await panel.boundingBox())!.height / main.height).toBeLessThan(0.72);
});

test("orbita-terminal divider is draggable to resize history and output panes", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await launch(page);
  await page.getByRole("button", { name: "Open kubectl terminal", exact: true }).first().click();
  const history = page.locator(".terminal-command-pane");
  const output = page.locator(".terminal-output-pane");
  const splitter = page.locator(".terminal-splitter");
  const beforeHistory = (await history.boundingBox())!.width;
  const beforeOutput = (await output.boundingBox())!.width;
  const drag = (await splitter.boundingBox())!;
  const y = drag.y + drag.height / 2;
  await page.mouse.move(drag.x + drag.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(drag.x + 120, y);
  await page.mouse.up();
  const afterHistory = (await history.boundingBox())!.width;
  const afterOutput = (await output.boundingBox())!.width;
  expect(afterHistory).toBeGreaterThan(beforeHistory + 80);
  expect(afterOutput).toBeLessThan(beforeOutput - 80);
});
