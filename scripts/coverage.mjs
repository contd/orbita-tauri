import path from "node:path";

const METRICS = { lines: ["LF", "LH"], functions: ["FNF", "FNH"], branches: ["BRF", "BRH"] };

function nonnegativeInteger(value, label) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`Invalid ${label} in LCOV coverage report.`);
  }
  return Number(value);
}

function metric(total, covered) {
  if (covered > total) throw new Error("LCOV covered count exceeds total.");
  // Match the two-decimal truncation used by Istanbul's detailed HTML reports.
  return { total, covered, pct: total === 0 ? null : Math.floor(covered * 10000 / total) / 100 };
}

export function parseCoverage(lcov, root = process.cwd()) {
  if (!lcov.trim().endsWith("end_of_record")) throw new Error("Incomplete LCOV coverage report.");
  const files = [];
  for (const record of lcov.split("end_of_record").filter(record => record.trim())) {
    const fields = new Map();
    const uncoveredLines = [];
    for (const line of record.trim().split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error("Invalid LCOV record.");
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (key === "DA") {
        const [lineNumber, hits] = value.split(",");
        const number = nonnegativeInteger(lineNumber, "line number");
        if (number === 0) throw new Error("LCOV line numbers must be positive.");
        if (nonnegativeInteger(hits, "line hits") === 0) uncoveredLines.push(number);
      } else if (key === "SF" || Object.values(METRICS).flat().includes(key)) {
        if (fields.has(key)) throw new Error(`Duplicate ${key} in LCOV coverage report.`);
        fields.set(key, value);
      }
    }
    const source = fields.get("SF");
    if (!source) throw new Error("LCOV record has no source file.");
    const filePath = path.relative(root, path.resolve(root, source)).replaceAll("\\", "/");
    if (!filePath.startsWith("src/") || !filePath.endsWith(".ts")) continue;
    if (files.some(file => file.path === filePath)) throw new Error(`Duplicate LCOV source file: ${filePath}`);
    const file = { path: filePath, uncoveredLines };
    for (const [name, [found, hit]] of Object.entries(METRICS)) {
      if (!fields.has(found) && !fields.has(hit) && name === "branches") {
        file[name] = null;
        continue;
      }
      file[name] = metric(
        nonnegativeInteger(fields.get(found), found),
        nonnegativeInteger(fields.get(hit), hit),
      );
    }
    files.push(file);
  }
  if (!files.length) throw new Error("LCOV coverage report contains no src/*.ts files.");
  const summary = {};
  for (const name of Object.keys(METRICS)) {
    summary[name] = files.some(file => file[name] === null) ? null : metric(
      files.reduce((sum, file) => sum + file[name].total, 0),
      files.reduce((sum, file) => sum + file[name].covered, 0),
    );
  }
  return { summary, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

export function formatCoverage(value) {
  if (value === null) return "Not reported";
  return `${value.pct === null ? "N/A" : `${value.pct.toFixed(2)}%`} (${value.covered}/${value.total})`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderUnitReport(stats, coverage) {
  const cells = value => ["lines", "functions", "branches"].map(name => `<td>${formatCoverage(value[name])}</td>`).join("");
  const rows = coverage.files.map(file => `<tr><td>${escapeHtml(file.path)}</td>${cells(file)}<td>${file.uncoveredLines.join(", ") || "None"}</td></tr>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orbita unit test report</title>
<style>body{font:16px system-ui,sans-serif;margin:2rem;line-height:1.5}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #aaa;padding:.5rem;text-align:left}td:last-child{overflow-wrap:anywhere}a{color:#1769aa}</style>
</head><body>
<h1>Orbita unit test report</h1>
<h2>Test outcomes</h2>
<p>Total: ${stats.total}; passed: ${stats.passed}; failed: ${stats.failed}; skipped: ${stats.skipped}.</p>
<p><a href="../unit.xml">Full JUnit report</a></p>
<h2>Code coverage</h2>
<p>Bun coverage of TypeScript files under src/ loaded by the unit tests. Dependencies and test helpers are excluded. Bun does not report branch coverage in LCOV. N/A means there are no measurable items, not 100% coverage.</p>
<table><thead><tr><th>Scope</th><th>Lines</th><th>Functions</th><th>Branches</th><th>Uncovered lines</th></tr></thead>
<tbody><tr><th>All measured source files</th>${cells(coverage.summary)}<td></td></tr>
${rows}</tbody></table>
<p><a href="../unit-coverage/lcov.info">Download raw LCOV coverage</a></p>
</body></html>
`;
}
