<img src="./src/assets/orbita-title.svg" width="100%" alt="ORBITA_" />


**An open-source desktop workspace for browsing Kubernetes clusters.**

Kubernetes GUI tools can involve trade-offs: some are proprietary or place key workflows behind paid tiers, while others can feel heavier and slower than everyday cluster work needs. Orbita aims to make common inspection tasks quick and approachable, with a focused desktop interface for cluster health, workloads, configuration, access control, and events.

Browse resources, inspect manifests, switch contexts, and run context-bound `kubectl` commands from one application. The project is built with Electron and TypeScript, and is available for Windows, macOS, and Linux.

# Features

<!-- FEATURES:START -->
_Auto-generated from Playwright screenshots in `e2e-results/screenshots` via `npm run docs:features`._

### Dashboard (dark theme)

Track cluster health at a glance in dark mode with summary metrics, workload readiness, and quick navigation cards.

![Dashboard (dark theme)](./e2e-results/screenshots/dashboard-dark.png)

### Dashboard (light theme)

Switch themes instantly while keeping the same at-a-glance cluster health insights and navigation shortcuts.

![Dashboard (light theme)](./e2e-results/screenshots/dashboard-light.png)

### In-app logs viewer

Open pod and node logs without leaving Orbita, then inspect output in a focused, scrollable panel.

![In-app logs viewer](./e2e-results/screenshots/logs-panel.png)

### Kubeconfig management

Add, validate, edit, and save kubeconfigs directly in Settings, then switch contexts from the same workspace.

![Kubeconfig management](./e2e-results/screenshots/settings-saved-kubeconfigs.png)

### Context-aware kubectl terminal

Run kubectl commands inside Orbita with context-safe execution, command history, and adjustable output panes.

![Context-aware kubectl terminal](./e2e-results/screenshots/terminal-panel.png)

### Clear tool availability status

When kubectl is unavailable, Orbita clearly communicates terminal limitations while keeping the rest of the app usable.

![Clear tool availability status](./e2e-results/screenshots/terminal-unavailable.png)

### ClusterRoleBindings resource view

Browse ClusterRoleBindings in a sortable table view with quick actions and detailed inspection support.

![ClusterRoleBindings resource view](./e2e-results/screenshots/view-clusterrolebindings.png)

### ClusterRoles resource view

Browse ClusterRoles in a sortable table view with quick actions and detailed inspection support.

![ClusterRoles resource view](./e2e-results/screenshots/view-clusterroles.png)

### ConfigMaps resource view

Browse ConfigMaps in a sortable table view with quick actions and detailed inspection support.

![ConfigMaps resource view](./e2e-results/screenshots/view-configmaps.png)

### CronJobs resource view

Browse CronJobs in a sortable table view with quick actions and detailed inspection support.

![CronJobs resource view](./e2e-results/screenshots/view-cronjobs.png)

### DaemonSets resource view

Browse DaemonSets in a sortable table view with quick actions and detailed inspection support.

![DaemonSets resource view](./e2e-results/screenshots/view-daemonsets.png)

### Deployments resource view

Browse Deployments in a sortable table view with quick actions and detailed inspection support.

![Deployments resource view](./e2e-results/screenshots/view-deployments.png)

### Events resource view

Browse Events in a sortable table view with quick actions and detailed inspection support.

![Events resource view](./e2e-results/screenshots/view-events.png)

### Ingresses resource view

Browse Ingresses in a sortable table view with quick actions and detailed inspection support.

![Ingresses resource view](./e2e-results/screenshots/view-ingresses.png)

### Jobs resource view

Browse Jobs in a sortable table view with quick actions and detailed inspection support.

![Jobs resource view](./e2e-results/screenshots/view-jobs.png)

### Namespaces resource view

Browse Namespaces in a sortable table view with quick actions and detailed inspection support.

![Namespaces resource view](./e2e-results/screenshots/view-namespaces.png)

### Nodes resource view

Browse Nodes in a sortable table view with quick actions and detailed inspection support.

![Nodes resource view](./e2e-results/screenshots/view-nodes.png)

### PersistentVolumeClaims resource view

Browse PersistentVolumeClaims in a sortable table view with quick actions and detailed inspection support.

![PersistentVolumeClaims resource view](./e2e-results/screenshots/view-persistentvolumeclaims.png)

### PersistentVolumes resource view

Browse PersistentVolumes in a sortable table view with quick actions and detailed inspection support.

![PersistentVolumes resource view](./e2e-results/screenshots/view-persistentvolumes.png)

### Pods resource view

Browse Pods in a sortable table view with quick actions and detailed inspection support.

![Pods resource view](./e2e-results/screenshots/view-pods.png)

### ReplicaSets resource view

Browse ReplicaSets in a sortable table view with quick actions and detailed inspection support.

![ReplicaSets resource view](./e2e-results/screenshots/view-replicasets.png)

### RoleBindings resource view

Browse RoleBindings in a sortable table view with quick actions and detailed inspection support.

![RoleBindings resource view](./e2e-results/screenshots/view-rolebindings.png)

### Roles resource view

Browse Roles in a sortable table view with quick actions and detailed inspection support.

![Roles resource view](./e2e-results/screenshots/view-roles.png)

### Secrets resource view

Browse Secrets in a sortable table view with quick actions and detailed inspection support.

![Secrets resource view](./e2e-results/screenshots/view-secrets.png)

### ServiceAccounts resource view

Browse ServiceAccounts in a sortable table view with quick actions and detailed inspection support.

![ServiceAccounts resource view](./e2e-results/screenshots/view-serviceaccounts.png)

### Services resource view

Browse Services in a sortable table view with quick actions and detailed inspection support.

![Services resource view](./e2e-results/screenshots/view-services.png)

### StatefulSets resource view

Browse StatefulSets in a sortable table view with quick actions and detailed inspection support.

![StatefulSets resource view](./e2e-results/screenshots/view-statefulsets.png)

### StorageClasses resource view

Browse StorageClasses in a sortable table view with quick actions and detailed inspection support.

![StorageClasses resource view](./e2e-results/screenshots/view-storageclasses.png)
<!-- FEATURES:END -->

## Kubeconfig discovery

At startup (and when running `kubectl`), Orbita uses the paths listed in
`KUBECONFIG`, in environment order, when that variable is set. Only when it is
unset does Orbita check the current user's `~/.kube/config` first. Separate
environment paths with `:` on macOS/Linux or `;` on Windows. A set but empty or
unusable `KUBECONFIG` does not silently fall back to the home config.

Only `.kubeconfig` and `.yaml` files from `KUBECONFIG` are included, and their
contents must parse as a kubeconfig with `apiVersion: v1`, `kind: Config`, and a
`contexts` list. Environment paths may also name directories, which are scanned
recursively in sorted order using the same file filters; hidden directories are
not scanned. Missing files and unrelated YAML documents are ignored; filesystem
access errors are reported.

The Settings search path, the legacy `~/kubeconfig` location, and saved in-app
configs are checked afterward. When `KUBECONFIG` is set, the Settings search path
does not reintroduce `~/.kube/config`. Duplicate files are included only once. This
order also determines precedence when `kubectl` merges configs with overlapping names.

### User PATH and desktop launches

On macOS/Linux, startup reads exported `PATH` and `KUBECONFIG` from the user's
interactive login shell (`SHELL`), including shell startup-file overrides. Windows
uses the environment inherited by the app process. The environment is captured
once per launch: the first executable on that PATH wins for `kubectl`, Docker,
kind, AWS CLI, and Bash detection. Orbita also passes the same PATH to `kubectl`
so credential plugins use the same tool overrides. Restart Orbita after changing
shell exports. Shell startup has a ten-second timeout; failures are displayed
rather than silently using a different PATH.

<!-- FEATURES:START -->
_Auto-generated from Playwright screenshots in `e2e-results/screenshots` via `npm run docs:features`._

### Dashboard (dark theme)

Track cluster health at a glance in dark mode with summary metrics, workload readiness, and quick navigation cards.

![Dashboard (dark theme)](./e2e-results/screenshots/dashboard-dark.png)

### Dashboard (light theme)

Switch themes instantly while keeping the same at-a-glance cluster health insights and navigation shortcuts.

![Dashboard (light theme)](./e2e-results/screenshots/dashboard-light.png)

### In-app logs viewer

Open pod and node logs without leaving Orbita, then inspect output in a focused, scrollable panel.

![In-app logs viewer](./e2e-results/screenshots/logs-panel.png)

### Kubeconfig management

Add, validate, edit, and save kubeconfigs directly in Settings, then switch contexts from the same workspace.

![Kubeconfig management](./e2e-results/screenshots/settings-saved-kubeconfigs.png)

### Context-aware kubectl terminal

Run kubectl commands inside Orbita with context-safe execution, command history, and adjustable output panes.

![Context-aware kubectl terminal](./e2e-results/screenshots/terminal-panel.png)

### Clear tool availability status

When kubectl is unavailable, Orbita clearly communicates terminal limitations while keeping the rest of the app usable.

![Clear tool availability status](./e2e-results/screenshots/terminal-unavailable.png)

### ClusterRoleBindings resource view

Browse ClusterRoleBindings in a sortable table view with quick actions and detailed inspection support.

![ClusterRoleBindings resource view](./e2e-results/screenshots/view-clusterrolebindings.png)

### ClusterRoles resource view

Browse ClusterRoles in a sortable table view with quick actions and detailed inspection support.

![ClusterRoles resource view](./e2e-results/screenshots/view-clusterroles.png)

### ConfigMaps resource view

Browse ConfigMaps in a sortable table view with quick actions and detailed inspection support.

![ConfigMaps resource view](./e2e-results/screenshots/view-configmaps.png)

### CronJobs resource view

Browse CronJobs in a sortable table view with quick actions and detailed inspection support.

![CronJobs resource view](./e2e-results/screenshots/view-cronjobs.png)

### DaemonSets resource view

Browse DaemonSets in a sortable table view with quick actions and detailed inspection support.

![DaemonSets resource view](./e2e-results/screenshots/view-daemonsets.png)

### Deployments resource view

Browse Deployments in a sortable table view with quick actions and detailed inspection support.

![Deployments resource view](./e2e-results/screenshots/view-deployments.png)

### Events resource view

Browse Events in a sortable table view with quick actions and detailed inspection support.

![Events resource view](./e2e-results/screenshots/view-events.png)

### Ingresses resource view

Browse Ingresses in a sortable table view with quick actions and detailed inspection support.

![Ingresses resource view](./e2e-results/screenshots/view-ingresses.png)

### Jobs resource view

Browse Jobs in a sortable table view with quick actions and detailed inspection support.

![Jobs resource view](./e2e-results/screenshots/view-jobs.png)

### Namespaces resource view

Browse Namespaces in a sortable table view with quick actions and detailed inspection support.

![Namespaces resource view](./e2e-results/screenshots/view-namespaces.png)

### Nodes resource view

Browse Nodes in a sortable table view with quick actions and detailed inspection support.

![Nodes resource view](./e2e-results/screenshots/view-nodes.png)

### PersistentVolumeClaims resource view

Browse PersistentVolumeClaims in a sortable table view with quick actions and detailed inspection support.

![PersistentVolumeClaims resource view](./e2e-results/screenshots/view-persistentvolumeclaims.png)

### PersistentVolumes resource view

Browse PersistentVolumes in a sortable table view with quick actions and detailed inspection support.

![PersistentVolumes resource view](./e2e-results/screenshots/view-persistentvolumes.png)

### Pods resource view

Browse Pods in a sortable table view with quick actions and detailed inspection support.

![Pods resource view](./e2e-results/screenshots/view-pods.png)

### ReplicaSets resource view

Browse ReplicaSets in a sortable table view with quick actions and detailed inspection support.

![ReplicaSets resource view](./e2e-results/screenshots/view-replicasets.png)

### RoleBindings resource view

Browse RoleBindings in a sortable table view with quick actions and detailed inspection support.

![RoleBindings resource view](./e2e-results/screenshots/view-rolebindings.png)

### Roles resource view

Browse Roles in a sortable table view with quick actions and detailed inspection support.

![Roles resource view](./e2e-results/screenshots/view-roles.png)

### Secrets resource view

Browse Secrets in a sortable table view with quick actions and detailed inspection support.

![Secrets resource view](./e2e-results/screenshots/view-secrets.png)

### ServiceAccounts resource view

Browse ServiceAccounts in a sortable table view with quick actions and detailed inspection support.

![ServiceAccounts resource view](./e2e-results/screenshots/view-serviceaccounts.png)

### Services resource view

Browse Services in a sortable table view with quick actions and detailed inspection support.

![Services resource view](./e2e-results/screenshots/view-services.png)

### StatefulSets resource view

Browse StatefulSets in a sortable table view with quick actions and detailed inspection support.

![StatefulSets resource view](./e2e-results/screenshots/view-statefulsets.png)

### StorageClasses resource view

Browse StorageClasses in a sortable table view with quick actions and detailed inspection support.

![StorageClasses resource view](./e2e-results/screenshots/view-storageclasses.png)
<!-- FEATURES:END -->

## Documentation and test reports

The [GitHub Pages documentation site](https://contd.github.io/orbita-tauri/) uses this README as its home page, alongside the TypeDoc API documentation and full test reports. Its module index groups documentation into **API**, **Scripts**, and **Tests**:

- [**Scripts**](https://contd.github.io/orbita-tauri/modules.html#scripts) documents coverage parsing, README generation, and release tooling.
- [**Tests**](https://contd.github.io/orbita-tauri/modules.html#tests) documents Bun unit suites, Node tooling tests, Playwright E2E suites, and shared helpers/fixtures. Suite pages describe their coverage; detailed execution results remain in the test reports.

TypeDoc expands all source files in `scripts/`, `tests/`, and `e2e/`. Module comments use `@module` and `@category` to keep these sections organized. `tsconfig.docs.json` includes JavaScript tooling and Bun/Node test declarations without changing the application build configuration.

The documentation uses `icon.svg` as its favicon and as the logo before the site
and page titles. TypeDoc copies the icon and `scripts/branding.css` into the
site assets so branding works on both the homepage and nested API pages.

```sh
npm test
npm run test:e2e
npm run docs:features
npm run docs:reports
```

Unit tests require Bun and write `reports/unit.xml` plus line/function coverage in `reports/unit-coverage/lcov.info`. Playwright writes `reports/e2e.json`, its standard HTML report to `playwright-report/`, and feature screenshots to `e2e-results/screenshots/`. Every E2E test uses a shared fixture to collect Chromium JavaScript coverage across navigations; Monocart generates a test report with an integrated coverage link at `reports/e2e-report/index.html` and source-mapped coverage details plus LCOV at `reports/e2e-report/coverage/`.

`npm run docs:reports` (also available as `npm run docs`) reads the test and coverage reports, updates only the marked test-report section below, generates a unit HTML report with per-file coverage and uncovered lines, and builds `docs-site/` with this README as the landing page. It includes the full test and coverage reports, title image, and feature screenshots. Missing or malformed reports cause the command to fail rather than publish misleading results. Run `npm run test:docs` to test the report generator.

On successful CI runs on `main` or release runs, the reports and screenshots are downloaded from the test jobs and the generated site is deployed to GitHub Pages. CI updates the README in its build workspace; it does not commit generated summaries back to the repository. To persist refreshed summaries in Git, run the commands locally and commit the README.

## Desktop releases

GitHub Actions publishes a release when a version tag such as `v1.1.0` is pushed. The CI workflow can also be run manually with a matching release tag. The versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` must match the tag; update and commit `src-tauri/Cargo.lock` after changing the Rust package version. Existing tags must point to the selected commit. CI/test/release jobs use Ubuntu 24.04 and Node 24-compatible actions; Linux installer builds remain on Ubuntu 22.04 for compatibility.

Use `npm version patch`, `npm version minor`, or `npm version <version>` to bump a release. The npm `version` hook synchronizes and stages all three native version files before npm creates its version commit and tag. Start from a clean working tree. If you edit `package.json` manually, run `npm run version:sync` and commit the updated native files before creating the tag. CI validates versions rather than silently changing them during a build. Rerunning an existing tag always uses that tag's original commit, not later fixes.

Both unit and E2E tests must pass before any native build job starts. Builds produce:

| Platform | Architecture | Downloads |
| --- | --- | --- |
| Windows | x64 | MSI and NSIS EXE |
| Linux | x64 | DEB, RPM, and AppImage |
| macOS | Universal (Apple Silicon and Intel) | DMG and app ZIP |

Only after all builds and the GitHub Pages deployment succeed does the workflow create a draft, upload every asset, and publish the release. Releases also include test/coverage reports and screenshots, a GitHub Pages snapshot archive, the generated README, `release-metadata.json` (version, commit, ref, working-tree status, test/coverage summaries, and workflow URL), release notes with a live Pages link, and `SHA256SUMS.txt`. The snapshot is immutable release documentation; the live Pages site can change after later releases. Prerelease versions such as `1.1.0-beta.1` are marked as GitHub prereleases.

Configure the repository's **Settings > Pages > Source** to **GitHub Actions**, and allow the `github-pages` environment to deploy from `main`, version tags, and any selected manual-release branches. Publishing uses the workflow's scoped `GITHUB_TOKEN`; no personal access token is required. A published release is never silently overwritten. If asset upload fails, the draft remains unpublished; inspect/delete that draft before rerunning.

These initial builds are **unsigned**, and macOS builds are **not notarized**. Windows SmartScreen or macOS Gatekeeper may warn or block installation. Only install builds you trust; on macOS, follow Apple's documented process for opening software from an unidentified developer. Signing/notarization certificates are not configured.

### Local macOS release

Install Bun, Node.js, Rust, and Xcode Command Line Tools (`xcode-select --install`), then:

```sh
bun install --frozen-lockfile
npm run release:macos
```

This command validates versions, runs type-checking, report/release-tool tests, unit tests, and Chromium E2E tests, regenerates documentation, and only then builds unsigned macOS DMG/app bundles using the locked Cargo dependencies. It packages the installers, reports, docs snapshot, metadata, and checksums in `release-assets/`, without uploading anything. Local builds target the host Mac's architecture; CI produces universal builds.

Move any existing files out of `release-assets/` before running again so previous release assets cannot be mixed into a new release. A dirty local working tree is allowed and explicitly recorded in the metadata; use a clean, committed tree for reproducible releases. Run `npm run test:release` to validate the release tooling.

## Project Support

Orbita is currently supported by:

|  |  |
| --- | --- |
| <img src="https://apex-industrial.com/wp-content/uploads/2021/10/ApexSCT_Small_Reverse_Dark_Small_Reverse.svg" width="200"> | <img src="https://veritasautomata.com/wp-content/uploads/2023/11/Veritas-Automata-Logo.png" width="200"> |
| [Apex Supply Chain Technologies](https://www.apexsupplychain.com) | [Veratas Automata](https://veritasautomata.com/) |

<!-- TEST-REPORTS:START -->
## Test reports

_Generated from the latest local or CI test reports by `npm run docs:reports`. Flaky tests passed only after retries and are counted separately._

| Suite | Total | Passed | Failed | Skipped | Flaky |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unit | 131 | 131 | 0 | 0 | 0 |
| E2E | 85 | 85 | 0 | 0 | 0 |

[Full unit report](https://contd.github.io/orbita-tauri/reports/unit-report/index.html) · [Unit JUnit XML](https://contd.github.io/orbita-tauri/reports/unit.xml) · [Full E2E report with coverage](https://contd.github.io/orbita-tauri/reports/e2e-report/index.html) · [Playwright HTML report](https://contd.github.io/orbita-tauri/e2e-report/index.html) · [E2E JSON](https://contd.github.io/orbita-tauri/reports/e2e.json)

### Code coverage

| Suite | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
| Unit | 96.55% (1345/1393) | 93.20% (288/309) | Not reported |
| E2E | 91.48% (1310/1432) | 90.95% (382/420) | 66.01% (909/1377) |

Coverage measures loaded TypeScript files under `src/`, excluding dependencies and test helpers. Unit coverage uses Bun; E2E coverage uses Chromium V8, mapped back to TypeScript through Vite source maps and converted to Istanbul HTML/LCOV. Summaries use the LCOV totals. These tools use different coverage instrumentation, so their percentages are not directly comparable. Bun does not report branch coverage in LCOV; "Not reported" is not zero coverage. "N/A" means there are no measurable items.

E2E coverage measures frontend JavaScript only, not the Rust backend, native Tauri APIs, or real cluster operations mocked by the tests.

[Detailed unit coverage](https://contd.github.io/orbita-tauri/reports/unit-report/index.html) · [Detailed E2E coverage](https://contd.github.io/orbita-tauri/reports/e2e-report/coverage/index.html) · [Unit LCOV](https://contd.github.io/orbita-tauri/reports/unit-coverage/lcov.info) · [E2E LCOV](https://contd.github.io/orbita-tauri/reports/e2e-report/coverage/lcov.info)

The full report links above are served on the [documentation site](https://contd.github.io/orbita-tauri/), not stored in Git.
<!-- TEST-REPORTS:END -->
