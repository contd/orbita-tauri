/**
 * Browser launch helpers and a deterministic mock native bridge.
 *
 * @remarks
 * The bridge records calls, persists mock preferences, and supplies demo cluster
 * resources so browser tests need no native runtime, kubectl, or live cluster.
 * @module e2e/helpers
 * @category Tests
 */
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { demo } from "../src/kubernetes";

/** Host and CLI availability flags supplied to the mock bridge. */
export type Options = {
  /** Whether kubectl is detected; defaults to true. */
  kubectl?: boolean;
  /** Whether Docker is detected; defaults to true. */
  docker?: boolean;
  /** Whether kind is detected; defaults to true. */
  kind?: boolean;
  /** Whether the AWS CLI is detected; defaults to true. */
  aws?: boolean;
  /** Whether Bash is detected; defaults to true. */
  bash?: boolean;
  /** Whether WSL is detected; defaults to the Windows host flag. */
  wsl?: boolean;
  /** Simulates a Windows host; defaults to false. */
  windows?: boolean;
};

/** Package fields needed to derive About-page expectations. */
type PackageJsonForTests = {
  name?: string;
  productName?: string;
  version?: string;
  author?: string | { name?: string; email?: string };
  repository?: string | { url?: string };
};

/**
 * Normalizes npm author metadata for About-page assertions.
 * @param author - Object or npm-style author string.
 * @returns Display name and email, with empty values when absent.
 */
function parseAuthor(author: PackageJsonForTests["author"]): { author: string; email: string } {
  if (!author) return { author: "", email: "" };
  if (typeof author === "object") return { author: author.name ?? "", email: author.email ?? "" };
  const email = /<([^>]+)>/.exec(author)?.[1] ?? "";
  return { author: author.replace(/<[^>]*>|\([^)]*\)/g, "").trim(), email };
}

/**
 * Normalizes npm repository metadata to a browser URL.
 * @param repository - Object or Git repository string.
 * @returns Repository URL without Git transport prefixes or the .git suffix.
 */
function parseRepository(repository: PackageJsonForTests["repository"]): string {
  const raw = typeof repository === "string" ? repository : repository?.url ?? "";
  return raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/\.git$/, "");
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJsonForTests;
const parsedAuthor = parseAuthor(pkg.author);

/** Expected About-page values read from the real package manifest. */
export const appPackageInfo = {
  name: pkg.productName?.replace(/\s+Tauri$/, "") || pkg.name?.replace(/^./, c => c.toUpperCase()) || "Orbita",
  packageName: pkg.name ?? "",
  version: pkg.version ?? "",
  author: parsedAuthor.author,
  email: parsedAuthor.email,
  repository: parseRepository(pkg.repository),
};

/**
 * Installs the mock bridge, navigates, and waits for the connected status bar.
 * @param page - Playwright page receiving the bridge.
 * @param options - Host and tool availability overrides.
 * @param path - Vite route to open; defaults to the app root.
 * @returns Resolves when the app reports the test context as connected.
 */
export async function launch(page: Page, options: Options = {}, path = "/") {
  await page.addInitScript(({ demo, tools, hostWindows }) => {
    const w = window as any;
    w.__CALLS__ = [];
    const stored = JSON.parse(localStorage.getItem("mock-prefs") ?? "{}");
    let prefs = { theme: "dark", density: "normal", searchPath: "~/.kube", namespace: "All namespaces", selectedContext: "test-context", savedConfigs: [], ...stored };
    w.__ORBITA_BRIDGE__ = async (command: string, args: any = {}) => {
      w.__CALLS__.push({ command, args });
      switch (command) {
        case "get_preferences": return prefs;
        case "save_preferences": prefs = args.preferences; localStorage.setItem("mock-prefs", JSON.stringify(prefs)); return null;
        case "check_cli_tools": return {
          host: { os: hostWindows ? "windows" : "macos", isWindows: hostWindows },
          tools: Object.fromEntries(
            Object.entries(tools).map(([k, v]) => [
              k,
              { available: v, path: v ? (hostWindows ? `C:/mock/${k}.exe` : `/usr/bin/${k}`) : undefined },
            ]),
          ),
        };
        case "get_contexts": {
          const extra = prefs.savedConfigs.flatMap((c: any) => [...c.yaml.matchAll(/^\s*-?\s*name:\s*(\S+)/gm)].map((m) => m[1]));
          return { contexts: [...new Set(["test-context", "other-context", ...extra])], selectedContext: prefs.selectedContext };
        }
        case "get_resources": {
          const items = Object.entries(demo).find(([kind]) => kind === args.kind)?.[1] ?? [];
          return args.namespace && args.namespace !== "All namespaces" ? items.filter((r: any) => !r.metadata.namespace || r.metadata.namespace === args.namespace) : items;
        }
        case "get_resource_metrics": {
          if (args.kind === "nodes") {
            return demo.nodes.map((node: any) => ({ metadata: node.metadata, usage: node.usage }));
          }
          if (args.kind === "pods") {
            const pods = args.namespace && args.namespace !== "All namespaces"
              ? demo.pods.filter((pod: any) => pod.metadata.namespace === args.namespace)
              : demo.pods;
            return pods.map((pod: any) => ({ metadata: pod.metadata, containers: pod.containers }));
          }
          throw new Error(`unexpected metrics kind ${String(args.kind)}`);
        }
        case "run_kubectl":
          return args.arguments?.includes("json")
            ? { stdout: JSON.stringify({ context: args.context, kind: "List", items: [] }), stderr: "", exitCode: 0 }
            : { stdout: `# context ${args.context}\nkind: List\nitems: []`, stderr: "", exitCode: 0 };
        case "get_logs": return args.kind === "nodes" ? "== payments/api-1 ==\nline from api\n\n== platform/worker-1 ==\nline from worker" : `log line for ${args.name}\n<script>alert(1)</script>`;
        default: throw new Error(`unexpected command ${command}`);
      }
    };
  }, {
    demo,
    hostWindows: options.windows ?? false,
    tools: {
      kubectl: options.kubectl ?? true,
      docker: options.docker ?? true,
      kind: options.kind ?? true,
      aws: options.aws ?? true,
      bash: options.bash ?? true,
      wsl: options.wsl ?? (options.windows ?? false),
    },
  });
  await page.goto(path);
  await expect(page.locator(".status-bar")).toContainText("Connected to test-context");
}
/**
 * Locates a navigation item by its visible label, allowing an icon and count.
 * @param page - App page.
 * @param label - Navigation label used in the matching regular expression.
 * @returns The first matching navigation item.
 */
export const nav = (page: Page, label: string) => page.locator(".nav-item", { hasText: new RegExp(`^\\s*\\S*\\s*${label}\\s*\\d*\\s*$`) }).first();
/**
 * Reads native bridge calls captured by the launch fixture.
 * @param page - App page containing the mock bridge.
 * @returns Recorded commands and arguments in invocation order.
 */
export const calls = (page: Page) => page.evaluate(() => (window as any).__CALLS__ as { command: string; args: any }[]);
