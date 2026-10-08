/**
 * Validates, synchronizes, collects, and packages native Orbita releases.
 *
 * @remarks
 * Commands: `sync`, `validate`, `collect <platform> [target]`, `prepare`, and
 * `macos`. CI uses the individual commands; `npm run release:macos` runs local
 * validation, tests, documentation, and an unsigned macOS build in sequence.
 * Assets include installers, reports, documentation, Git metadata, and checksums.
 * @module scripts/release
 * @category Scripts
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { summarizeE2e, summarizeUnit } from "./generate-test-docs.mjs";
import { formatCoverage, parseCoverage } from "./coverage.mjs";

const OUTPUT = "release-assets";
const PACKAGE_TYPES = {
  windows: [".msi", ".exe"],
  linux: [".deb", ".rpm", ".AppImage"],
  macos: [".dmg"],
};

/**
 * Requires npm, Tauri, Cargo, and the release tag to agree on a release version.
 * @param {{version: string}} pkg - npm package metadata.
 * @param {{version: string}} tauri - Tauri configuration.
 * @param {string} cargo - Cargo manifest text.
 * @param {string} tag - Expected Git tag, defaulting to the npm version prefixed by v.
 * @returns {{version: string, tag: string, prerelease: boolean}} Validated release identity.
 * @throws If the version format or any manifest/tag version is inconsistent.
 */
export function validateVersions(pkg, tauri, cargo, tag = `v${pkg.version}`) {
  const cargoVersion = /^\[package\]\s*[\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    throw new Error("package.json must contain a release version such as 1.0.0 or 1.0.0-beta.1.");
  }
  if (tauri.version !== pkg.version || cargoVersion !== pkg.version) {
    throw new Error(`Release versions must match: package.json=${pkg.version}, src-tauri/tauri.conf.json=${tauri.version}, src-tauri/Cargo.toml=${cargoVersion ?? "missing"}.`);
  }
  if (tag !== `v${pkg.version}`) throw new Error(`Release tag must be v${pkg.version}, received ${tag}.`);
  return { version: pkg.version, tag, prerelease: pkg.version.includes("-") };
}

/**
 * Runs a child process and rejects unexpected exit codes.
 * @param {string} command - Executable name.
 * @param {string[]} args - Arguments passed without a shell.
 * @param {import("node:child_process").SpawnOptions & {capture?: boolean, allowedCodes?: number[]}} options - Spawn options and output/exit-code policy.
 * @returns {Promise<{code: number, stdout: string}>} Exit code and trimmed captured stdout.
 */
function run(command, args, { capture = false, allowedCodes = [0], ...options } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", ...options });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", data => { stdout += data; });
      child.stderr.on("data", data => { stderr += data; });
    }
    child.on("error", reject);
    child.on("close", code => {
      if (!allowedCodes.includes(code)) reject(new Error(`${command} ${args.join(" ")} failed (${code}): ${stderr}`));
      else resolve({ code, stdout: stdout.trim() });
    });
  });
}

/**
 * Reads release manifests from disk and validates their versions.
 * @param {string} root - Repository root.
 * @param {string} [tag] - Optional expected release tag.
 * @returns {Promise<ReturnType<typeof validateVersions>>} Validated release identity.
 */
export async function validateRelease(root = process.cwd(), tag) {
  const [pkg, tauri, cargo] = await Promise.all([
    fs.readFile(path.join(root, "package.json"), "utf8"),
    fs.readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
    fs.readFile(path.join(root, "src-tauri/Cargo.toml"), "utf8"),
  ]);
  return validateVersions(JSON.parse(pkg), JSON.parse(tauri), cargo, tag);
}

/**
 * Produces native manifest text synchronized to npm without changing dependencies.
 * @param {{version: string}} pkg - npm version source.
 * @param {string} tauriText - Tauri JSON text.
 * @param {string} cargo - Cargo manifest text.
 * @param {string} lock - Cargo lockfile text.
 * @returns {{tauri: string, cargo: string, lock: string}} Updated native file contents.
 * @throws If required version fields or the app lockfile entry are missing.
 */
export function synchronizedVersions(pkg, tauriText, cargo, lock) {
  const tauri = JSON.parse(tauriText);
  const packageSection = /(^\[package\][^\n]*\n)([\s\S]*?)(?=^\[|(?![\s\S]))/m;
  const section = packageSection.exec(cargo);
  if (!section || !/^version\s*=\s*"[^"]+"/m.test(section[2])) {
    throw new Error("Cargo.toml has no explicit package version.");
  }
  const updatedCargo = cargo.replace(packageSection, (_, heading, body) =>
    heading + body.replace(/^(version\s*=\s*")[^"]+(")/m, (_, before, after) => `${before}${pkg.version}${after}`));
  validateVersions(pkg, { ...tauri, version: pkg.version }, updatedCargo);
  const lockPackage = /(^\[\[package\]\]\r?\nname = "orbita-tauri"\r?\nversion = ")[^"]+(")/m;
  if (!lockPackage.test(lock)) throw new Error("Cargo.lock has no orbita-tauri package version.");
  if (!/^  "version": "[^"]+",?$/m.test(tauriText)) throw new Error("Tauri config has no explicit version field.");
  return {
    tauri: tauriText.replace(/^(  "version": ")[^"]+(")/m, (_, before, after) => `${before}${pkg.version}${after}`),
    cargo: updatedCargo,
    lock: lock.replace(lockPackage, (_, before, after) => `${before}${pkg.version}${after}`),
  };
}

/**
 * Writes synchronized native versions for the npm version lifecycle hook.
 * @param {string} root - Repository root.
 * @returns {Promise<void>} Resolves after all three native version files are written.
 */
export async function synchronizeVersions(root = process.cwd()) {
  const files = ["package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock"];
  const [pkg, tauri, cargo, lock] = await Promise.all(files.map(file => fs.readFile(path.join(root, file), "utf8")));
  const updated = synchronizedVersions(JSON.parse(pkg), tauri, cargo, lock);
  await Promise.all(Object.values(updated).map((text, index) => fs.writeFile(path.join(root, files[index + 1]), text)));
  console.log(`Synchronized native release versions to ${JSON.parse(pkg).version}.`);
}

/**
 * Lists bundle paths recursively, treating macOS app bundles as single assets.
 * @param {string} directory - Directory to traverse.
 * @returns {Promise<string[]>} Files and app-bundle directories.
 */
async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const lists = await Promise.all(entries.map(async entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.name.endsWith(".app")) return walk(file);
    return [file];
  }));
  return lists.flat();
}

/**
 * Copies current-version native installers into release-assets.
 * @param {"windows" | "linux" | "macos"} platform - Installer family.
 * @param {string} target - Rust target, or empty to use the host build directory.
 * @param {string} root - Repository root.
 * @returns {Promise<void>} Resolves after installer copies and any macOS app ZIP are complete.
 * @throws If required installer types are missing or build inputs are invalid.
 */
export async function collectBundles(platform, target = "", root = process.cwd()) {
  const extensions = PACKAGE_TYPES[platform];
  if (!extensions) throw new Error(`Unsupported release platform: ${platform}`);
  if (target && !/^[a-z0-9_-]+$/.test(target)) throw new Error("Invalid build target.");
  const { version } = await validateRelease(root);
  const directory = path.join(root, "src-tauri/target", target, "release/bundle");
  const files = await walk(directory);
  const versionPattern = new RegExp(`(?:^|[_-])${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[_-]|\\.[A-Za-z]+$|$)`);
  const installers = files.filter(file => extensions.includes(path.extname(file)) && versionPattern.test(path.basename(file)));
  for (const extension of extensions) {
    if (!installers.some(file => file.endsWith(extension))) throw new Error(`Missing ${platform} ${extension} installer in ${directory}.`);
  }
  const output = path.join(root, OUTPUT);
  await fs.mkdir(output, { recursive: true });
  const architecture = target || os.arch();
  for (const file of installers) {
    await fs.copyFile(file, path.join(output, `${platform}-${architecture}-${path.basename(file)}`));
  }
  if (platform === "macos") {
    const apps = files.filter(file => file.endsWith(".app"));
    if (apps.length !== 1) throw new Error(`Expected one macOS app bundle, found ${apps.length}.`);
    await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", apps[0], path.join(output, `Orbita-${version}-macos-${architecture}.app.zip`)]);
  }
  console.log(`Collected ${platform} release bundles in ${output}.`);
}

/**
 * Writes sorted SHA-256 checksums for files, excluding the checksum file itself.
 * @param {string} directory - Release asset directory.
 * @returns {Promise<void>} Resolves after SHA256SUMS.txt is written.
 * @throws If there are no release assets.
 */
export async function writeChecksums(directory) {
  const files = (await fs.readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name !== "SHA256SUMS.txt")
    .map(entry => entry.name).sort();
  if (!files.length) throw new Error("No release assets to checksum.");
  const lines = await Promise.all(files.map(async file => {
    const digest = createHash("sha256").update(await fs.readFile(path.join(directory, file))).digest("hex");
    return `${digest}  ${file}`;
  }));
  await fs.writeFile(path.join(directory, "SHA256SUMS.txt"), `${lines.join("\n")}\n`);
}

/**
 * Packages passing test reports, the docs snapshot, release notes, and provenance.
 * @param {string} root - Repository root containing installers and generated reports.
 * @param {NodeJS.ProcessEnv} env - Release tag, GitHub run, repository, and Pages metadata.
 * @returns {Promise<void>} Resolves after archives, metadata, notes, and checksums are written.
 * @throws If manifests disagree, test reports fail or are empty, or required assets are missing.
 */
export async function prepareRelease(root = process.cwd(), env = process.env) {
  const release = await validateRelease(root, env.RELEASE_TAG || undefined);
  const [unitXml, e2eJson, unitLcov, e2eLcov] = await Promise.all([
    fs.readFile(path.join(root, "reports/unit.xml"), "utf8"),
    fs.readFile(path.join(root, "reports/e2e.json"), "utf8"),
    fs.readFile(path.join(root, "reports/unit-coverage/lcov.info"), "utf8"),
    fs.readFile(path.join(root, "reports/e2e-report/coverage/lcov.info"), "utf8"),
    fs.access(path.join(root, "docs-site/index.html")),
  ]);
  const unit = summarizeUnit(unitXml);
  const e2e = summarizeE2e(JSON.parse(e2eJson));
  if (!unit.total || !e2e.total || unit.failed || e2e.failed) throw new Error("Release requires non-empty, passing unit and E2E test reports.");
  const coverage = {
    unit: parseCoverage(unitLcov, root).summary,
    e2e: parseCoverage(e2eLcov, root).summary,
  };
  const git = async args => (await run("git", args, { cwd: root, capture: true })).stdout;
  const [commit, branch, status, commitInfo] = await Promise.all([
    git(["rev-parse", "HEAD"]),
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["status", "--porcelain"]),
    git(["log", "-1", "--format=%cI%n%s"]),
  ]);
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const repository = env.GITHUB_REPOSITORY || new URL(pkg.repository.url).pathname.slice(1).replace(/\.git$/, "");
  const pages = env.PAGES_URL || "https://contd.github.io/orbita-tauri/";
  const output = path.join(root, OUTPUT);
  const installers = (await fs.readdir(output)).filter(file => /\.(?:msi|exe|deb|rpm|AppImage|dmg|app\.zip)$/.test(file)).sort();
  if (!installers.length) throw new Error("No native installers found in release-assets.");
  const metadata = {
    ...release, repository, commit, branch, dirty: Boolean(status), workingTreeStatus: status,
    commitInfo, generatedAt: new Date().toISOString(), platform: os.platform(), architecture: os.arch(),
    workflowRun: env.GITHUB_RUN_ID ? `https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    pages, tests: { unit, e2e }, coverage, installers, unsigned: true,
  };
  await run("tar", ["-czf", path.join(output, `Orbita-${release.version}-test-reports.tar.gz`), "reports", "playwright-report", "e2e-results/screenshots"], { cwd: root });
  await run("tar", ["-czf", path.join(output, `Orbita-${release.version}-github-pages.tar.gz`), "docs-site"], { cwd: root });
  await fs.copyFile(path.join(root, "README.md"), path.join(output, `Orbita-${release.version}-README.md`));
  await fs.writeFile(path.join(output, "release-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  const coverageRow = (suite, data) => `| ${suite} | ${formatCoverage(data.lines)} | ${formatCoverage(data.functions)} | ${formatCoverage(data.branches)} |`;
  const notes = `# Orbita ${release.tag}

The release workflow supports unsigned Windows (x64), Linux (x64), and macOS builds. macOS CI builds are universal (Apple Silicon and Intel); local releases include macOS only and use the host architecture.

## Included installers

${installers.map(file => `- \`${file}\``).join("\n")}

## Installation

- Windows: use the MSI or NSIS EXE installer. SmartScreen may warn because builds are unsigned.
- Linux: use the DEB, RPM, or AppImage. For AppImage, grant execute permission before launching.
- macOS: use the DMG or extract the app ZIP. These builds are not signed or notarized, so Gatekeeper may block them; follow Apple's documented process to open an app from an unidentified developer only if you trust this build.

## Validation

- Unit tests: ${unit.passed}/${unit.total} passed; ${unit.skipped} skipped.
- E2E tests: ${e2e.passed}/${e2e.total} passed; ${e2e.flaky} flaky; ${e2e.skipped} skipped.

| Suite | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
${coverageRow("Unit", coverage.unit)}
${coverageRow("E2E", coverage.e2e)}

Coverage measures loaded frontend TypeScript; it does not include the Rust backend. Bun does not provide branch coverage.

## Documentation and provenance

- [GitHub Pages](${pages}) (live site; may change after this release).
- The GitHub Pages archive contains the exact documentation snapshot for this release.
- The test-reports archive includes unit and E2E results, coverage, and screenshots.
- Commit: [${commit}](https://github.com/${repository}/commit/${commit}).
- Ref: ${env.GITHUB_REF || branch}.
- Working tree: ${status ? "modified (see release-metadata.json)" : "clean"}.
${metadata.workflowRun ? `- [Workflow run](${metadata.workflowRun}).\n` : ""}
See \`release-metadata.json\` for Git/build metadata and \`SHA256SUMS.txt\` for asset integrity checks.
`;
  await fs.writeFile(path.join(output, "RELEASE-NOTES.md"), notes);
  await writeChecksums(output);
  console.log(`Prepared release reports, documentation, metadata and checksums in ${output}.`);
}

/**
 * Gates an unsigned local macOS release on type checks, tests, and documentation.
 * @returns {Promise<void>} Resolves after native builds and release asset preparation.
 * @throws If not running on macOS or the output directory already contains assets.
 */
async function localMacos() {
  if (os.platform() !== "darwin") throw new Error("release:macos must run on macOS.");
  await validateRelease();
  const existing = await fs.readdir(OUTPUT).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (existing.length) throw new Error("release-assets is not empty. Move the previous release files before building another release.");
  await run("bun", ["x", "tsc", "--noEmit"]);
  await run("bun", ["run", "test:docs"]);
  await run("bun", ["run", "test:release"]);
  await run("bun", ["run", "test"]);
  await run("bun", ["x", "playwright", "install", "chromium"]);
  await run("bun", ["run", "test:e2e"]);
  await run("bun", ["run", "docs:features"]);
  await run("bun", ["run", "docs:reports"]);
  await run("bun", ["run", "tauri", "build", "--ci", "--no-sign", "--bundles", "app,dmg", "--", "--locked"]);
  await collectBundles("macos");
  await prepareRelease();
}

/**
 * Dispatches CLI commands and checks tag provenance during release validation.
 * @returns {Promise<void>} Resolves when the selected release command completes.
 * @throws If the command is unknown or a release tag points to another commit.
 */
async function main() {
  const [command, platform, target] = process.argv.slice(2);
  if (command === "sync") return synchronizeVersions();
  if (command === "macos") return localMacos();
  if (command === "collect") return collectBundles(platform, target);
  if (command === "prepare") return prepareRelease();
  if (command !== "validate") throw new Error("Usage: release.mjs sync | validate | macos | collect <platform> [target] | prepare");
  const release = await validateRelease(process.cwd(), process.env.RELEASE_TAG || undefined);
  const commit = (await run("git", ["rev-parse", "HEAD"], { capture: true })).stdout;
  const tagCommit = await run("git", ["rev-parse", "-q", "--verify", `refs/tags/${release.tag}^{commit}`], { capture: true, allowedCodes: [0, 1] });
  if (tagCommit.code === 0 && tagCommit.stdout !== commit) throw new Error(`Tag ${release.tag} points to a different commit.`);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `tag=${release.tag}\nprerelease=${release.prerelease}\n`);
  }
  console.log(`Validated ${release.tag} at ${commit}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error("Release failed:", error);
    process.exitCode = 1;
  });
}
