import { defineConfig } from "@playwright/test";
import type { MonocartReporterOptions } from "monocart-reporter";
import path from "node:path";

const coverageReporter: MonocartReporterOptions = {
  name: "Orbita E2E test report",
  outputFile: "reports/e2e-report/index.html",
  coverage: {
    name: "Orbita frontend E2E coverage",
    reports: ["html", "lcovonly"],
    entryFilter: entry => /^https?:\/\/[^/]+\/src\//.test(entry.url),
    sourceFilter: sourcePath => /(?:^|\/)src\/.*\.ts$/.test(sourcePath),
    sourcePath: (sourcePath, info) => {
      const normalized = sourcePath.replace(/^.*?\/(?=src\/)/, "");
      // Vite's inline source maps name sibling sources without their directory.
      return !normalized.includes("/") && info.distFile
        ? path.posix.join(path.posix.dirname(info.distFile), normalized)
        : normalized;
    },
  },
};

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "reports/e2e.json" }],
    ["monocart-reporter", coverageReporter],
  ],
  use: { baseURL: "http://localhost:1420", viewport: { width: 1440, height: 900 } },
  webServer: { command: "bun run dev", url: "http://localhost:1420", reuseExistingServer: true, timeout: 60_000 },
});
