import type { OutputFormat, Resource, ResourceKey } from "../kubernetes";
import type { AboutInfo } from "../package-info";

/** A page the app can show: the dashboard, settings, about, or one resource collection. */
export type View = "dashboard" | "settings" | "about" | ResourceKey;
/**
 * State of the logs drawer.
 * `state` is the load phase, `body` the log text or error message, `title` the drawer heading and `opener` the
 * key of the control to refocus when the drawer closes.
 */
export type LogsState = { title: string; body: string; state: "loading" | "ready" | "error" | "empty"; opener: string };
/** One executed terminal command: the text, its combined output, and its exit code as text. */
export interface HistoryEntry { command: string; output: string; status: string }
/** UI styling properties for one context option in the sidebar context selector. */
export interface ContextOptionStyle {
  accent: string;
  border: string;
  background: string;
  text: string;
}
/** One selectable context with label/value plus style metadata consumed by the context web component. */
export interface ContextOption {
  value: string;
  label: string;
  style: ContextOptionStyle;
}
/** Availability state for command-line tools shown in the status bar. */
export interface CliState {
  kubectl: boolean;
  docker: boolean;
  kind: boolean;
  aws: boolean;
  bash: boolean;
  wsl: boolean;
  hostWindows: boolean;
}

/** Everything the renderers read. It is a snapshot-style view of the controller's state; renderers never mutate it. */
export interface RenderState {
  /** Page currently shown. */
  view: View;
  /** Active table search text. */
  search: string;
  /** Active table sort column label and direction (`1` ascending, `-1` descending). */
  sort: { column: string; direction: number };
  /** Resource shown in the inspector panel, or `null` when closed. */
  inspector: Resource | null;
  /** Open modal dialog, or `null`. */
  dialog: "add-config" | null;
  /** True when the sidebar is collapsed to its icon-only form. */
  sidebarCollapsed: boolean;
  /** Sidebar groups that are folded. */
  collapsed: Set<string>;
  /** Detection result for each command-line tool. */
  cli: CliState;
  /** True until the first tool detection completes. */
  cliChecking: boolean;
  /** Executable path per detected tool. */
  cliPaths: Record<string, string>;
  /** Whether the terminal dialog is open. */
  terminalOpen: boolean;
  /** Whether the terminal panel fills the full height of the app instead of about two thirds. */
  terminalExpanded: boolean;
  /** Width percentage of the command pane in the terminal body. */
  terminalSplit: number;
  /** Per-resource table column widths (pixels), keyed by resource view and ordered left-to-right. */
  tableColumnWidths: Partial<Record<ResourceKey, number[]>>;
  /** Output format requested for commands: kubectl text or JSON. */
  terminalFormat: OutputFormat;
  /** Current text in the command box. */
  terminalInput: string;
  /** Standard output of the last command. */
  terminalOutput: string;
  /** Standard error of the last command. */
  terminalStderr: string;
  /** Exit code of the last command, or `null` before any run. */
  terminalStatus: string | null;
  /** Commands run so far, oldest first. */
  terminalHistory: HistoryEntry[];
  /** Available Kubernetes context names. */
  contextNames: string[];
  /** Context options including style metadata used by the context selector component. */
  contextOptions: ContextOption[];
  /** Context currently in use. */
  selectedContext: string;
  /** Collections that have data; only these show sidebar counts. */
  loaded: Set<ResourceKey>;
  /** Collections currently being fetched. */
  loadingCollections: Set<ResourceKey>;
  /** Logs drawer state, or `null` when closed. */
  logs: LogsState | null;
  /** Application metadata from `package.json`, shown on the About page and in the status bar. */
  about: AboutInfo;
  /** Banner message; empty means no banner. */
  notice: string;
  /** Human-readable time of the last refresh. */
  refreshTime: string;
  /** User preferences (theme, density, search path, namespace, selected context, saved kubeconfigs). */
  settings: any;
  /** True after settings were saved, to show the confirmation. */
  settingsSaved: boolean;
  /** Resource data for every collection. */
  snapshot: Record<ResourceKey, Resource[]>;
  /** True when running in Tauri or with a test bridge. */
  bridged: boolean;
}


/** Collections that can show logs: pods, the workload kinds that own pods, jobs, and nodes. */
export const logKinds = new Set<ResourceKey>(["pods", "deployments", "daemonsets", "statefulsets", "replicasets", "jobs", "nodes"]);
