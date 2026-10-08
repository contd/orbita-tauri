/**
 * Converts Playwright screenshots into illustrated README feature descriptions.
 *
 * @remarks
 * Run `npm run docs:features` after screenshot-producing E2E tests. Known images
 * use curated titles; resource-view images and other filenames use derived titles.
 * This command updates the Features section without building the TypeDoc site.
 * @module scripts/generate-features-readme
 * @category Scripts
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "e2e-results/screenshots");
const README_PATH = path.resolve(process.cwd(), "README.md");

const FEATURE_OVERRIDES = {
  "dashboard-dark": {
    title: "Dashboard (dark theme)",
    description: "Track cluster health at a glance in dark mode with summary metrics, workload readiness, and quick navigation cards.",
  },
  "dashboard-light": {
    title: "Dashboard (light theme)",
    description: "Switch themes instantly while keeping the same at-a-glance cluster health insights and navigation shortcuts.",
  },
  "logs-panel": {
    title: "In-app logs viewer",
    description: "Open pod and node logs without leaving Orbita, then inspect output in a focused, scrollable panel.",
  },
  "settings-saved-kubeconfigs": {
    title: "Kubeconfig management",
    description: "Add, validate, edit, and save kubeconfigs directly in Settings, then switch contexts from the same workspace.",
  },
  "terminal-panel": {
    title: "Context-aware kubectl terminal",
    description: "Run kubectl commands inside Orbita with context-safe execution, command history, and adjustable output panes.",
  },
  "terminal-unavailable": {
    title: "Clear tool availability status",
    description: "When kubectl is unavailable, Orbita clearly communicates terminal limitations while keeping the rest of the app usable.",
  },
};

const VIEW_LABELS = {
  clusterrolebindings: "ClusterRoleBindings",
  clusterroles: "ClusterRoles",
  configmaps: "ConfigMaps",
  cronjobs: "CronJobs",
  daemonsets: "DaemonSets",
  deployments: "Deployments",
  events: "Events",
  ingresses: "Ingresses",
  jobs: "Jobs",
  namespaces: "Namespaces",
  nodes: "Nodes",
  persistentvolumeclaims: "PersistentVolumeClaims",
  persistentvolumes: "PersistentVolumes",
  pods: "Pods",
  replicasets: "ReplicaSets",
  rolebindings: "RoleBindings",
  roles: "Roles",
  secrets: "Secrets",
  serviceaccounts: "ServiceAccounts",
  services: "Services",
  statefulsets: "StatefulSets",
  storageclasses: "StorageClasses",
};

/**
 * Converts a hyphenated screenshot basename to a readable title.
 * @param {string} baseName - Filename without its extension.
 * @returns {string} Space-separated, capitalized title.
 */
function titleFromFilename(baseName) {
  return baseName
    .split("-")
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Chooses curated or filename-derived copy for a screenshot.
 * @param {string} baseName - Screenshot basename.
 * @returns {{title: string, description: string}} Feature heading and description.
 */
function describeFeature(baseName) {
  const override = FEATURE_OVERRIDES[baseName];
  if (override) return override;
  if (baseName.startsWith("view-")) {
    const key = baseName.slice("view-".length);
    const label = VIEW_LABELS[key] ?? titleFromFilename(key);
    return {
      title: `${label} resource view`,
      description: `Browse ${label} in a sortable table view with quick actions and detailed inspection support.`,
    };
  }
  const title = titleFromFilename(baseName);
  return {
    title,
    description: `Feature preview for ${title}.`,
  };
}

/**
 * Renders the marked Markdown feature gallery in the supplied image order.
 * @param {string[]} imageFiles - Screenshot filenames.
 * @returns {string} Features heading, descriptions, and image links.
 */
function renderFeaturesSection(imageFiles) {
  const rows = imageFiles.map((fileName) => {
    const baseName = path.parse(fileName).name;
    const feature = describeFeature(baseName);
    const imagePath = `./e2e-results/screenshots/${fileName}`.replaceAll("\\", "/");
    return `### ${feature.title}

${feature.description}

![${feature.title}](${imagePath})`;
  });

  const startMarker = "<!-- FEATURES:START -->";
  const endMarker = "<!-- FEATURES:END -->";
  return `# Features

${startMarker}
_Auto-generated from Playwright screenshots in \`e2e-results/screenshots\` via \`npm run docs:features\`._

${rows.join("\n\n")}
${endMarker}`;
}

/**
 * Replaces an existing Features section or inserts one before Project Support.
 * @param {string} readme - Current README text.
 * @param {string} section - Complete replacement feature section.
 * @returns {string} Updated README text.
 */
function replaceFeaturesSection(readme, section) {
  const lines = readme.split("\n");
  const headingIndex = lines.findIndex(line => line.trim() === "# Features");
  if (headingIndex >= 0) {
    let nextHeadingIndex = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      if (/^#{1,2}\s+/.test(lines[i])) {
        nextHeadingIndex = i;
        break;
      }
    }
    const before = lines.slice(0, headingIndex).join("\n").trimEnd();
    const after = lines.slice(nextHeadingIndex).join("\n").trimStart();
    return `${before}\n\n${section}\n\n${after}\n`;
  }

  const projectSupportIndex = readme.search(/^## Project Support/m);
  if (projectSupportIndex >= 0) {
    const before = readme.slice(0, projectSupportIndex).trimEnd();
    const after = readme.slice(projectSupportIndex).trimStart();
    return `${before}\n\n${section}\n\n${after}\n`;
  }

  return `${readme.trimEnd()}\n\n${section}\n`;
}

/**
 * Collects supported screenshots and writes the generated README feature gallery.
 * @returns {Promise<void>} Resolves after the README has been updated.
 * @throws If screenshots are unavailable or filesystem operations fail.
 */
async function main() {
  const entries = await fs.readdir(SCREENSHOT_DIR, { withFileTypes: true });
  const imageFiles = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(fileName => [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(fileName).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (imageFiles.length === 0) {
    throw new Error("No screenshots found in e2e-results/screenshots. Run Playwright tests that generate screenshots first.");
  }

  const readme = await fs.readFile(README_PATH, "utf8");
  const featuresSection = renderFeaturesSection(imageFiles);
  const updatedReadme = replaceFeaturesSection(readme, featuresSection);
  await fs.writeFile(README_PATH, updatedReadme, "utf8");

  process.stdout.write(`Updated README.md with ${imageFiles.length} feature screenshots.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
