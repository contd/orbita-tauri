import assert from "node:assert/strict";
import { test } from "node:test";
import { renderReports, summarizeE2e, summarizeUnit, updateReadme } from "./generate-test-docs.mjs";
import { formatCoverage, parseCoverage, renderUnitReport } from "./coverage.mjs";

const coverageFixture = `TN:
SF:src/example.ts
FNF:2
FNH:1
DA:1,1
DA:2,0
DA:3,1
DA:4,0
LF:4
LH:2
end_of_record
`;

test("unit totals include failures, errors, and skips without double-counting suites", () => {
  assert.deepEqual(summarizeUnit('<testsuites tests="8" failures="1" errors="1" skipped="2"><testsuite tests="8"/></testsuites>'),
    { total: 8, passed: 4, failed: 2, skipped: 2, flaky: 0 });
});

test("unit reports support suite-only and multiple-suite formats", () => {
  assert.equal(summarizeUnit('<testsuite tests="2" failures="0"/>').passed, 2);
  assert.deepEqual(summarizeUnit('<testsuites><testsuite tests="2" failures="1"/><testsuite tests="3" skipped="1"/></testsuites>'),
    { total: 5, passed: 3, failed: 1, skipped: 1, flaky: 0 });
});

test("invalid unit reports fail explicitly", () => {
  for (const xml of ["<testsuites>", "<foo/>", "<testsuites/>", '<testsuite tests="-1"/>', '<testsuite tests="2" failures="3"/>']) {
    assert.throws(() => summarizeUnit(xml));
  }
});

test("Playwright totals count flaky tests separately from first-run passes", () => {
  assert.deepEqual(summarizeE2e({ stats: { expected: 5, unexpected: 1, skipped: 2, flaky: 3 }, errors: [] }),
    { total: 11, passed: 5, failed: 1, skipped: 2, flaky: 3 });
});

test("invalid and interrupted Playwright reports fail explicitly", () => {
  for (const report of [
    {},
    { stats: { expected: 1, unexpected: 0, skipped: 0 }, errors: [] },
    { stats: { expected: -1, unexpected: 0, skipped: 0, flaky: 0 }, errors: [] },
    { stats: { expected: true, unexpected: 0, skipped: 0, flaky: 0 }, errors: [] },
    { stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, errors: [{ message: "Interrupted" }] },
  ]) assert.throws(() => summarizeE2e(report));
});

test("README insertion and replacement are idempotent and preserve surrounding content", () => {
  const stats = { total: 3, passed: 2, failed: 1, skipped: 0, flaky: 0 };
  const coverage = parseCoverage(coverageFixture).summary;
  const section = renderReports(stats, stats, coverage, coverage);
  assert.match(section, /\| Unit \| 3 \| 2 \| 1 \| 0 \| 0 \|/);
  assert.match(section, /\| E2E \| 3 \| 2 \| 1 \| 0 \| 0 \|/);
  assert.match(section, /### Code coverage/);
  assert.match(section, /\| Unit \| 50.00% \(2\/4\) \| 50.00% \(1\/2\) \| Not reported \|/);
  const inserted = updateReadme("# Orbita\n\nOriginal text.\n", section);
  assert.ok(inserted.startsWith("# Orbita\n\nOriginal text.\n"));
  assert.equal(updateReadme(inserted, section), inserted);
  const original = "Before\n<!-- TEST-REPORTS:START -->\nOld\n<!-- TEST-REPORTS:END -->\nAfter\n";
  assert.equal(updateReadme(original, section), `Before\n${section}\nAfter\n`);
});

test("LCOV summaries exclude tests and dependencies and retain uncovered lines", () => {
  const coverage = parseCoverage(coverageFixture + coverageFixture.replace("src/example.ts", "tests/helper.ts"));
  assert.equal(coverage.files.length, 1);
  assert.deepEqual(coverage.files[0].uncoveredLines, [2, 4]);
  assert.deepEqual(coverage.summary, {
    lines: { total: 4, covered: 2, pct: 50 },
    functions: { total: 2, covered: 1, pct: 50 },
    branches: null,
  });
});

test("LCOV percentages are weighted by measured counts, not averages of percentages", () => {
  const second = coverageFixture.replace("src/example.ts", "src/other.ts").replace("LF:4", "LF:6").replace("LH:2", "LH:6");
  const coverage = parseCoverage(coverageFixture + second);
  assert.deepEqual(coverage.summary.lines, { total: 10, covered: 8, pct: 80 });
});

test("branch coverage and empty metrics are distinguished from unsupported metrics", () => {
  const coverage = parseCoverage(coverageFixture.replace("LF:4", "BRF:4\nBRH:3\nLF:4"));
  assert.deepEqual(coverage.summary.branches, { total: 4, covered: 3, pct: 75 });
  assert.equal(formatCoverage(coverage.summary.branches), "75.00% (3/4)");
  assert.equal(formatCoverage(null), "Not reported");
  assert.equal(formatCoverage({ total: 0, covered: 0, pct: null }), "N/A (0/0)");
  const fractional = parseCoverage(coverageFixture.replace("LF:4", "BRF:3\nBRH:2\nLF:4"));
  assert.equal(formatCoverage(fractional.summary.branches), "66.66% (2/3)");
});

test("missing, malformed and inconsistent coverage fails rather than showing a successful summary", () => {
  for (const lcov of [
    "",
    coverageFixture.replace("end_of_record", ""),
    coverageFixture.replace("SF:src/example.ts\n", ""),
    coverageFixture.replace("src/example.ts", "tests/example.ts"),
    coverageFixture.replace("LF:4", "LF:invalid"),
    coverageFixture.replace("LH:2", "LH:5"),
    coverageFixture.replace("LF:4\n", ""),
    coverageFixture.replace("FNH:1\n", ""),
    coverageFixture.replace("LF:4", "BRF:4\nLF:4"),
    coverageFixture.replace("LF:4", "LF:4\nLF:4"),
    coverageFixture + coverageFixture,
    coverageFixture.replace("DA:2,0", "DA:0,0"),
  ]) assert.throws(() => parseCoverage(lcov));
});

test("unit HTML report includes test outcomes, coverage totals and uncovered lines", () => {
  const stats = { total: 10, passed: 7, failed: 2, skipped: 1 };
  const html = renderUnitReport(stats, parseCoverage(coverageFixture));
  assert.match(html, /Total: 10; passed: 7; failed: 2; skipped: 1/);
  assert.match(html, /<h2>Code coverage<\/h2>/);
  assert.match(html, /50.00% \(2\/4\)/);
  assert.match(html, /<td>2, 4<\/td>/);
  assert.match(html, /href="\.\.\/unit-coverage\/lcov.info"/);
  assert.match(html, /href="\.\.\/unit.xml"/);
  const escaped = renderUnitReport(stats, parseCoverage(coverageFixture.replace("src/example.ts", "src/<example>.ts")));
  assert.match(escaped, /src\/&lt;example&gt;.ts/);
  assert.doesNotMatch(escaped, /src\/<example>.ts/);
});

test("damaged or duplicate README markers fail without overwriting content", () => {
  for (const readme of [
    "<!-- TEST-REPORTS:START -->",
    "<!-- TEST-REPORTS:END -->",
    "<!-- TEST-REPORTS:END --><!-- TEST-REPORTS:START -->",
    "<!-- TEST-REPORTS:START --><!-- TEST-REPORTS:START --><!-- TEST-REPORTS:END -->",
    "<!-- TEST-REPORTS:START --><!-- TEST-REPORTS:END --><!-- TEST-REPORTS:END -->",
  ]) assert.throws(() => updateReadme(readme, "new"));
});
