import { test as base } from "@playwright/test";
import { addCoverageReport } from "monocart-reporter";

export { expect } from "@playwright/test";

export const test = base.extend<{ frontendCoverage: void }>({
  frontendCoverage: [async ({ page, browserName }, use, testInfo) => {
    if (browserName !== "chromium") {
      throw new Error("Frontend coverage requires Chromium's JavaScript coverage API.");
    }
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    try {
      await use();
    } finally {
      const coverage = await page.coverage.stopJSCoverage();
      await addCoverageReport(coverage, testInfo);
    }
  }, { auto: true }],
});
