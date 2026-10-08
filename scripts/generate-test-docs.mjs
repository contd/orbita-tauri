/**
 * Generates the README test summary and the TypeDoc GitHub Pages site.
 *
 * @remarks
 * Run `npm run docs:reports` after unit and E2E tests have generated their reports
 * and coverage. The site uses the README as its home page, documents API, Scripts,
 * and Tests modules, and copies detailed reports and screenshots into the output.
 * @module scripts/generate-test-docs
 * @category Scripts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { Application } from "typedoc";
import { formatCoverage, parseCoverage, renderUnitReport } from "./coverage.mjs";

const START = "<!-- TEST-REPORTS:START -->";
const END = "<!-- TEST-REPORTS:END -->";

/**
 * Validates a required test-report count.
 * @param {unknown} value - Numeric value or numeric string from a report.
 * @param {string} label - Name included in validation errors.
 * @returns {number} Nonnegative safe integer.
 * @throws If the count is absent or invalid.
 */
function count(value, label) {
  const number = Number(value);
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "" || !Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid or missing ${label} in test report.`);
  }
  return number;
}

/**
 * Summarizes JUnit XML without double-counting nested suite totals.
 * @param {string} xml - Bun JUnit report.
 * @returns Unit totals with failures and errors combined and flaky set to zero.
 * @throws If XML, suite totals, or outcome counts are invalid.
 */
export function summarizeUnit(xml) {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`Invalid unit JUnit XML: ${valid.err.msg}`);
  const document = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const root = document.testsuites ?? document.testsuite;
  if (!root) throw new Error("Unit report has no testsuites or testsuite element.");
  const suites = root["@_tests"] !== undefined
    ? [root]
    : [root.testsuite].flat().filter(Boolean);
  if (suites.length === 0) throw new Error("Unit report has no suite totals.");
  const result = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
  for (const suite of suites) {
    const total = count(suite["@_tests"], "unit tests");
    const failed = count(suite["@_failures"] ?? 0, "unit failures") + count(suite["@_errors"] ?? 0, "unit errors");
    const skipped = count(suite["@_skipped"] ?? 0, "unit skipped");
    if (failed + skipped > total) throw new Error("Unit report totals are inconsistent.");
    result.total += total;
    result.failed += failed;
    result.skipped += skipped;
    result.passed += total - failed - skipped;
  }
  return result;
}

/**
 * Summarizes Playwright outcomes, counting retry passes separately as flaky.
 * @param {{stats: {expected: number, unexpected: number, skipped: number, flaky: number}, errors: unknown[]}} report - Playwright JSON report.
 * @returns Total, passed, failed, skipped, and flaky counts.
 * @throws If the report is incomplete or contains run-level errors.
 */
export function summarizeE2e(report) {
  if (!report.stats || !Array.isArray(report.errors)) throw new Error("Invalid Playwright JSON report.");
  if (report.errors.length) throw new Error("Playwright report contains run-level errors; inspect reports/e2e.json.");
  const passed = count(report.stats.expected, "e2e expected");
  const failed = count(report.stats.unexpected, "e2e unexpected");
  const skipped = count(report.stats.skipped, "e2e skipped");
  const flaky = count(report.stats.flaky, "e2e flaky");
  return { total: passed + failed + skipped + flaky, passed, failed, skipped, flaky };
}

/**
 * Builds the marked README section containing test outcomes and coverage links.
 * @param {ReturnType<typeof summarizeUnit>} unit - Unit outcomes.
 * @param {ReturnType<typeof summarizeE2e>} e2e - Browser test outcomes.
 * @param {ReturnType<typeof parseCoverage>["summary"]} unitCoverage - Unit coverage totals.
 * @param {ReturnType<typeof parseCoverage>["summary"]} e2eCoverage - Browser coverage totals.
 * @returns {string} Markdown enclosed in test-report markers.
 */
export function renderReports(unit, e2e, unitCoverage, e2eCoverage) {
  const row = (name, stats) => `| ${name} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${stats.skipped} | ${stats.flaky} |`;
  return `${START}
## Test reports

_Generated from the latest local or CI test reports by \`npm run docs:reports\`. Flaky tests passed only after retries and are counted separately._

| Suite | Total | Passed | Failed | Skipped | Flaky |
| --- | ---: | ---: | ---: | ---: | ---: |
${row("Unit", unit)}
${row("E2E", e2e)}

[Full unit report](https://contd.github.io/orbita-tauri/reports/unit-report/index.html) · [Unit JUnit XML](https://contd.github.io/orbita-tauri/reports/unit.xml) · [Full E2E report with coverage](https://contd.github.io/orbita-tauri/reports/e2e-report/index.html) · [Playwright HTML report](https://contd.github.io/orbita-tauri/e2e-report/index.html) · [E2E JSON](https://contd.github.io/orbita-tauri/reports/e2e.json)

### Code coverage

| Suite | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
| Unit | ${formatCoverage(unitCoverage.lines)} | ${formatCoverage(unitCoverage.functions)} | ${formatCoverage(unitCoverage.branches)} |
| E2E | ${formatCoverage(e2eCoverage.lines)} | ${formatCoverage(e2eCoverage.functions)} | ${formatCoverage(e2eCoverage.branches)} |

Coverage measures loaded TypeScript files under \`src/\`, excluding dependencies and test helpers. Unit coverage uses Bun; E2E coverage uses Chromium V8, mapped back to TypeScript through Vite source maps and converted to Istanbul HTML/LCOV. Summaries use the LCOV totals. These tools use different coverage instrumentation, so their percentages are not directly comparable. Bun does not report branch coverage in LCOV; "Not reported" is not zero coverage. "N/A" means there are no measurable items.

E2E coverage measures frontend JavaScript only, not the Rust backend, native Tauri APIs, or real cluster operations mocked by the tests.

[Detailed unit coverage](https://contd.github.io/orbita-tauri/reports/unit-report/index.html) · [Detailed E2E coverage](https://contd.github.io/orbita-tauri/reports/e2e-report/coverage/index.html) · [Unit LCOV](https://contd.github.io/orbita-tauri/reports/unit-coverage/lcov.info) · [E2E LCOV](https://contd.github.io/orbita-tauri/reports/e2e-report/coverage/lcov.info)

The full report links above are served on the [documentation site](https://contd.github.io/orbita-tauri/), not stored in Git.
${END}`;
}

/**
 * Inserts or replaces the test-report section while preserving other README text.
 * @param {string} readme - Existing README content.
 * @param {string} section - Replacement marked section.
 * @returns {string} Updated README.
 * @throws If existing markers are incomplete, duplicated, or out of order.
 */
export function updateReadme(readme, section) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 && end < 0) return `${readme.trimEnd()}\n\n${section}\n`;
  if (start < 0 || end < start || readme.indexOf(START, start + START.length) >= 0 || readme.indexOf(END, end + END.length) >= 0) {
    throw new Error("README test-report markers are missing, duplicated, or out of order.");
  }
  return readme.slice(0, start) + section + readme.slice(end + END.length);
}

/**
 * Validates reports, updates the README, and builds the documentation site.
 * @param {string} root - Repository containing reports, assets, and TypeDoc configuration.
 * @returns {Promise<void>} Resolves after documentation and report assets are written.
 * @throws If required inputs are missing, reports are malformed, or TypeDoc fails.
 */
export async function generateDocs(root = process.cwd()) {
  const [xml, json, readme, unitLcov, e2eLcov] = await Promise.all([
    fs.readFile(path.join(root, "reports/unit.xml"), "utf8"),
    fs.readFile(path.join(root, "reports/e2e.json"), "utf8"),
    fs.readFile(path.join(root, "README.md"), "utf8"),
    fs.readFile(path.join(root, "reports/unit-coverage/lcov.info"), "utf8"),
    fs.readFile(path.join(root, "reports/e2e-report/coverage/lcov.info"), "utf8"),
    fs.access(path.join(root, "reports/e2e-report/index.html")),
    fs.access(path.join(root, "reports/e2e-report/coverage/index.html")),
    fs.access(path.join(root, "playwright-report/index.html")),
    fs.access(path.join(root, "e2e-results/screenshots")),
    fs.access(path.join(root, "src/assets/orbita-title.svg")),
  ]);
  const unit = summarizeUnit(xml);
  const unitCoverage = parseCoverage(unitLcov, root);
  const e2eCoverage = parseCoverage(e2eLcov, root);
  const section = renderReports(unit, summarizeE2e(JSON.parse(json)), unitCoverage.summary, e2eCoverage.summary);
  await fs.mkdir(path.join(root, "reports/unit-report"), { recursive: true });
  await fs.writeFile(path.join(root, "reports/unit-report/index.html"), renderUnitReport(unit, unitCoverage));
  await fs.writeFile(path.join(root, "README.md"), updateReadme(readme, section));
  const app = await Application.bootstrapWithPlugins({ options: path.join(root, "typedoc.json") });
  const project = await app.convert();
  if (!project) throw new Error("TypeDoc could not convert the project.");
  await app.generateDocs(project, path.join(root, "docs-site"));
  if (app.logger.hasErrors()) throw new Error("TypeDoc reported errors while generating documentation.");
  await Promise.all([
    fs.cp(path.join(root, "reports"), path.join(root, "docs-site/reports"), { recursive: true }),
    fs.cp(path.join(root, "playwright-report"), path.join(root, "docs-site/e2e-report"), { recursive: true }),
    fs.cp(path.join(root, "e2e-results/screenshots"), path.join(root, "docs-site/e2e-results/screenshots"), { recursive: true }),
    fs.cp(path.join(root, "src/assets/orbita-title.svg"), path.join(root, "docs-site/src/assets/orbita-title.svg")),
    fs.writeFile(path.join(root, "docs-site/.nojekyll"), ""),
  ]);
  console.log("Updated README.md test reports and built docs-site with README.md as its home page.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateDocs().catch(error => {
    console.error("Documentation generation failed. Run npm test and npm run test:e2e first.", error);
    process.exitCode = 1;
  });
}
