import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: "http://localhost:1420", viewport: { width: 1440, height: 900 } },
  webServer: { command: "bun run dev", url: "http://localhost:1420", reuseExistingServer: true, timeout: 60_000 },
});
