/**
 * Playwright fixtures with automatic source-mapped frontend coverage collection.
 *
 * @remarks
 * Every E2E suite imports this test fixture. Coverage begins before the test and
 * is submitted to Monocart in a finally block, including when assertions fail.
 * Only Chromium is supported because collection uses its JavaScript coverage API.
 * @module e2e/fixtures
 * @category Tests
 */
import { test as base } from "@playwright/test";
import { addCoverageReport } from "monocart-reporter";

/** Playwright assertions re-exported for coverage-enabled test suites. */
export { expect } from "@playwright/test";

/** Base Playwright test extended with an automatic frontend coverage fixture. */
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
