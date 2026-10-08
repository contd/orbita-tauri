import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { demo } from "../src/kubernetes";

export type Options = {
  kubectl?: boolean;
  docker?: boolean;
  kind?: boolean;
  aws?: boolean;
  bash?: boolean;
  wsl?: boolean;
  windows?: boolean;
};

type PackageJsonForTests = {
  name?: string;
  productName?: string;
  version?: string;
  author?: string | { name?: string; email?: string };
  repository?: string | { url?: string };
};

function parseAuthor(author: PackageJsonForTests["author"]): { author: string; email: string } {
  if (!author) return { author: "", email: "" };
  if (typeof author === "object") return { author: author.name ?? "", email: author.email ?? "" };
  const email = /<([^>]+)>/.exec(author)?.[1] ?? "";
  return { author: author.replace(/<[^>]*>|\([^)]*\)/g, "").trim(), email };
}

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

export const appPackageInfo = {
  name: pkg.productName?.replace(/\s+Tauri$/, "") || pkg.name?.replace(/^./, c => c.toUpperCase()) || "Orbita",
  packageName: pkg.name ?? "",
  version: pkg.version ?? "",
  author: parsedAuthor.author,
  email: parsedAuthor.email,
  repository: parseRepository(pkg.repository),
};

/** Installs a deterministic bridge so the app runs with no kubectl, kubeconfig or cluster. */
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
          const items = demo[args.kind] ?? [];
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
export const nav = (page: Page, label: string) => page.locator(".nav-item", { hasText: new RegExp(`^\\s*\\S*\\s*${label}\\s*\\d*\\s*$`) }).first();
export const calls = (page: Page) => page.evaluate(() => (window as any).__CALLS__ as { command: string; args: any }[]);
