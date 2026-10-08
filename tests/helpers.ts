/**
 * Shared render-state fixtures for Bun unit tests.
 * @module tests/helpers
 * @category Tests
 */
import { demo, type ResourceKey } from "../src/kubernetes";
import type { RenderState } from "../src/components/types";

/**
 * Builds a complete demo-mode render state with optional top-level overrides.
 * @param over - Fields to replace in the default fixture.
 * @returns A render state with demo resources, CLI flags, settings, and metadata.
 */
export function makeState(over: Partial<RenderState> = {}): RenderState {
  return {
    view: "dashboard", search: "", sort: { column: "Name", direction: 1 }, inspector: null, dialog: null, collapsed: new Set(), sidebarCollapsed: false,
    cli: { kubectl: true, docker: true, kind: false, aws: false, bash: true, wsl: false, hostWindows: false }, cliChecking: false, cliPaths: {},
    terminalOpen: false, terminalFormat: "text", terminalExpanded: false, terminalSplit: 18, tableColumnWidths: {}, terminalInput: "", terminalOutput: "", terminalStderr: "", terminalStatus: null, terminalHistory: [],
    contextNames: ["test-context"], selectedContext: "test-context",
    contextOptions: [{ value: "test-context", label: "test-context", style: { accent: "#7aa2ff", border: "#425a78", background: "#141d29", text: "#d7e6ff" } }],
    loaded: new Set<ResourceKey>(["pods"]), loadingCollections: new Set(), logs: null,
    about: { name: "Orbita", packageName: "orbita-tauri", version: "1.2.3", description: "", author: "", email: "", repository: "", keywords: [] },
    notice: "hello", refreshTime: "Just now",
    settings: { theme: "dark", density: "normal", searchPath: "~/.kube", namespace: "All namespaces", selectedContext: "test-context", savedConfigs: [] },
    settingsSaved: false, snapshot: { ...demo }, bridged: false,
    ...over,
  };
}
