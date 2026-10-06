import { defineComponent } from "./base";
import type { RenderState } from "./types";

type CliTool = { key: Exclude<keyof RenderState["cli"], "hostWindows">; label: string };

const baseTools: CliTool[] = [
  { key: "kubectl", label: "kubectl" },
  { key: "docker", label: "Docker" },
  { key: "kind", label: "kind" },
  { key: "aws", label: "aws" },
  { key: "bash", label: "bash" },
];
const windowsTools: CliTool[] = [{ key: "wsl", label: "WSL" }];

export function renderCli(s: RenderState): string {
  const tools: CliTool[] = s.cli.hostWindows ? [...baseTools, ...windowsTools] : baseTools;
  return `<div class="cli-status">${tools.map(({ key, label }) => {
    const detected = s.cli[key];
    const state = s.cliChecking ? "Checking availability" : detected ? "Detected" : "Not detected";
    return `<div class="cli-pill" data-cli="${key}" tabindex="0" role="img" aria-label="${label}: ${state}" title="${label}: ${state}"><span class="cli-dot ${detected ? "up" : ""}"></span>${label}<span class="cli-tooltip" role="tooltip">${state}</span></div>`;
  }).join("")}</div>`;
}

defineComponent("orbita-cli-status", renderCli);
