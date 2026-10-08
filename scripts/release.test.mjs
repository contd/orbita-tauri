import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { collectBundles, prepareRelease, validateVersions, writeChecksums } from "./release.mjs";

const cargo = '[package]\nname = "orbita-tauri"\nversion = "1.0.0"\n';

test("release version must match all manifests and the tag", () => {
  assert.deepEqual(validateVersions({ version: "1.0.0" }, { version: "1.0.0" }, cargo),
    { version: "1.0.0", tag: "v1.0.0", prerelease: false });
  for (const [pkg, tauri, rust, tag] of [
    [{ version: "1.0.0" }, { version: "0.1.0" }, cargo, "v1.0.0"],
    [{ version: "1.0.0" }, { version: "1.0.0" }, cargo.replace("1.0.0", "0.1.0"), "v1.0.0"],
    [{ version: "1.0.0" }, { version: "1.0.0" }, cargo, "v2.0.0"],
    [{ version: "bad" }, { version: "bad" }, cargo, "vbad"],
  ]) assert.throws(() => validateVersions(pkg, tauri, rust, tag));
});

test("prerelease tags are identified", () => {
  const version = "1.1.0-beta.1";
  assert.equal(validateVersions({ version }, { version }, cargo.replace("1.0.0", version)).prerelease, true);
});

async function fixture(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "orbita-release-test-"));
  try {
    await fs.mkdir(path.join(root, "src-tauri"), { recursive: true });
    await fs.writeFile(path.join(root, "package.json"), '{"version":"1.0.0"}');
    await fs.writeFile(path.join(root, "src-tauri/tauri.conf.json"), '{"version":"1.0.0"}');
    await fs.writeFile(path.join(root, "src-tauri/Cargo.toml"), cargo);
    await callback(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("collecting bundles requires every expected package type and rejects invalid inputs", async () => {
  await fixture(async root => {
    const bundle = path.join(root, "src-tauri/target/x86_64-pc-windows-msvc/release/bundle");
    await fs.mkdir(path.join(bundle, "msi"), { recursive: true });
    await fs.mkdir(path.join(bundle, "nsis"), { recursive: true });
    await fs.writeFile(path.join(bundle, "msi/Orbita_1.0.0.msi"), "msi");
    await assert.rejects(collectBundles("windows", "x86_64-pc-windows-msvc", root), /Missing windows .exe/);
    await fs.writeFile(path.join(bundle, "nsis/Orbita_1.0.0.exe"), "nsis");
    await fs.writeFile(path.join(bundle, "msi/Orbita_0.1.0.msi"), "stale version");
    await collectBundles("windows", "x86_64-pc-windows-msvc", root);
    const files = await fs.readdir(path.join(root, "release-assets"));
    assert.deepEqual(files.sort(), [
      "windows-x86_64-pc-windows-msvc-Orbita_1.0.0.exe",
      "windows-x86_64-pc-windows-msvc-Orbita_1.0.0.msi",
    ]);
    await assert.rejects(collectBundles("unknown", "", root), /Unsupported/);
    await assert.rejects(collectBundles("windows", "../../outside", root), /Invalid build target/);
  });

});

test("release packaging rejects failed or empty test reports before producing assets", async () => {
  for (const [unit, e2e] of [
    ['<testsuites tests="2" failures="1"/>', { expected: 2, unexpected: 0, skipped: 0, flaky: 0 }],
    ['<testsuites tests="2" failures="0"/>', { expected: 1, unexpected: 1, skipped: 0, flaky: 0 }],
    ['<testsuites tests="0" failures="0"/>', { expected: 2, unexpected: 0, skipped: 0, flaky: 0 }],
    ['<testsuites tests="2" failures="0"/>', { expected: 0, unexpected: 0, skipped: 0, flaky: 0 }],
  ]) {
    await fixture(async root => {
      await fs.mkdir(path.join(root, "reports/unit-coverage"), { recursive: true });
      await fs.mkdir(path.join(root, "reports/e2e-report/coverage"), { recursive: true });
      await fs.mkdir(path.join(root, "docs-site"));
      await fs.writeFile(path.join(root, "reports/unit.xml"), unit);
      await fs.writeFile(path.join(root, "reports/e2e.json"), JSON.stringify({ stats: e2e, errors: [] }));
      await fs.writeFile(path.join(root, "reports/unit-coverage/lcov.info"), "");
      await fs.writeFile(path.join(root, "reports/e2e-report/coverage/lcov.info"), "");
      await fs.writeFile(path.join(root, "docs-site/index.html"), "");
      await assert.rejects(prepareRelease(root, {}), /requires non-empty, passing/);
      await assert.rejects(fs.access(path.join(root, "release-assets")), { code: "ENOENT" });
    });
  }
});

test("checksums include all assets in deterministic order and omit the checksum file", async () => {
  await fixture(async root => {
    const output = path.join(root, "release-assets");
    await fs.mkdir(output);
    await fs.writeFile(path.join(output, "b.txt"), "hello");
    await fs.writeFile(path.join(output, "a.txt"), "hello");
    await writeChecksums(output);
    const checksum = await fs.readFile(path.join(output, "SHA256SUMS.txt"), "utf8");
    assert.equal(checksum,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  a.txt\n" +
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  b.txt\n");
    await writeChecksums(output);
    assert.equal(await fs.readFile(path.join(output, "SHA256SUMS.txt"), "utf8"), checksum);
  });
});
