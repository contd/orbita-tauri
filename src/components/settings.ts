import { escapeHtml } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

type SavedConfig = { id: string; name: string; yaml: string };
type CliToolRow = { key: string; label: string };

/** CLI tools shown in Settings; WSL appears only on Windows hosts. */
function cliToolsFor(s: RenderState): CliToolRow[] {
  return [
    { key: "kubectl", label: "kubectl" },
    { key: "docker", label: "Docker" },
    { key: "kind", label: "kind" },
    { key: "aws", label: "aws" },
    { key: "bash", label: "bash" },
    ...(s.cli.hostWindows ? [{ key: "wsl", label: "WSL" }] : []),
  ];
}

/** Saved kubeconfigs from preferences, normalized for rendering. */
function savedConfigs(s: RenderState): SavedConfig[] {
  return (s.settings.savedConfigs ?? []) as SavedConfig[];
}

function renderDiscoveryCard(s: RenderState): string {
  return `<section class="panel settings-card">
    <div class="settings-card-title">
      <div class="settings-icon">⌘</div>
      <div>
        <h2>Kubeconfig discovery</h2>
        <p>Choose where Orbita searches for Kubernetes configuration files.</p>
      </div>
    </div>
    <form id="settings-form">
      <label class="field-label" for="search-path">Search path</label>
      <div class="input-with-icon">
        <span>⌁</span>
        <input id="search-path" value="${escapeHtml(s.settings.searchPath)}" placeholder="~/.kube" required>
      </div>
      <small class="field-help">A file or directory. Leave the default to use ~/.kube/config and KUBECONFIG.</small>
      <div class="form-actions">
        <button type="button" class="button secondary" data-action="cancel-settings">Cancel</button>
        <button type="button" class="button primary" data-action="save-settings">Save changes</button>
      </div>
      ${s.settingsSaved ? `<p class="inline-success" id="settings-success">✓ Settings saved and context discovery refreshed.</p>` : ""}
    </form>
  </section>`;
}

function renderSavedConfigCard(config: SavedConfig): string {
  return `<div class="saved-config">
    <div class="saved-config-title">
      <div>
        <strong>${escapeHtml(config.name)}</strong>
        <span>Saved configuration</span>
      </div>
      <button class="text-button danger-text" data-action="remove-config" data-id="${escapeHtml(config.id)}">Remove</button>
    </div>
    <textarea data-config="${escapeHtml(config.id)}" aria-label="Kubeconfig YAML for ${escapeHtml(config.name)}">${escapeHtml(config.yaml)}</textarea>
    <div class="saved-config-actions">
      <span>YAML configuration</span>
      <button class="button secondary" data-action="save-config" data-id="${escapeHtml(config.id)}">Save kubeconfig</button>
    </div>
  </div>`;
}

function renderSavedConfigsCard(s: RenderState): string {
  const configs = savedConfigs(s);
  const body = configs.length
    ? configs.map(renderSavedConfigCard).join("")
    : `<div class="empty-config"><span>⌘</span><strong>No saved kubeconfigs</strong><p>Add a pasted configuration to keep it available across sessions.</p></div>`;
  return `<section class="panel settings-card">
    <div class="settings-card-title">
      <div class="settings-icon lilac">⌑</div>
      <div>
        <h2>Saved kubeconfigs</h2>
        <p>Configurations pasted into Orbita are stored locally in your app data.</p>
      </div>
      <button class="button secondary small-button" data-action="add-config">${icon("plus")} Add kubeconfig</button>
    </div>
    ${body}
  </section>`;
}

function renderAppearanceCard(s: RenderState): string {
  return `<section class="panel settings-card">
    <div class="settings-card-title">
      <div class="settings-icon mint-icon">◐</div>
      <div>
        <h2>Appearance</h2>
        <p>Make the workspace yours.</p>
      </div>
    </div>
    <div class="appearance-row">
      <div><strong>Theme</strong><span>Choose a light or dark interface.</span></div>
      <div class="segmented">
        <button data-theme="light" class="${s.settings.theme === "light" ? "selected" : ""}">☼ Light</button>
        <button data-theme="dark" class="${s.settings.theme === "dark" ? "selected" : ""}">◐ Dark</button>
      </div>
    </div>
    <div class="appearance-row">
      <div><strong>Density</strong><span>Adjust spacing in resource tables.</span></div>
      <select id="settings-density" class="settings-select">
        <option value="cozy" ${s.settings.density === "cozy" ? "selected" : ""}>Cozy</option>
        <option value="normal" ${s.settings.density === "normal" ? "selected" : ""}>Normal</option>
        <option value="compact" ${s.settings.density === "compact" ? "selected" : ""}>Compact</option>
      </select>
    </div>
  </section>`;
}

function renderCliToolRow(s: RenderState, tool: CliToolRow): string {
  const detected = s.cli[tool.key as keyof typeof s.cli];
  const state = s.cliChecking ? "Checking availability" : detected ? "Detected" : "Not detected";
  const path = s.cliPaths[tool.key] ?? (s.cliChecking ? "Checking availability" : "Executable not found on PATH");
  return `<div class="tool-row">
    <span class="tool-status-dot ${detected ? "up" : ""}"></span>
    <strong>${tool.label}</strong>
    <span>${state}</span>
  </div>
  <small class="tool-path">${escapeHtml(path)}</small>`;
}

function renderCliToolsCard(s: RenderState): string {
  return `<section class="panel side-settings-card">
    <span class="settings-aside-icon">◉</span>
    <h3>CLI tools</h3>
    <p>Orbita uses local command-line tools when available.</p>
    ${cliToolsFor(s).map(tool => renderCliToolRow(s, tool)).join("")}
  </section>`;
}

function renderHelpCard(): string {
  return `<section class="panel help-card">
    <span>✧</span>
    <strong>Need a hand?</strong>
    <p>Install kubectl to connect Orbita to a Kubernetes cluster.</p>
    <button data-view="about" class="subtle-button">About Orbita ${icon("arrow")}</button>
  </section>`;
}

/** Settings view with kubeconfig management, appearance options, and CLI diagnostics. */
export function renderSettings(s: RenderState): string {
  return `<div class="page-content settings-page">
    <div class="page-title-row">
      <div>
        <div class="eyebrow">PREFERENCES <span>·</span> WORKSPACE</div>
        <h1>Settings</h1>
        <p class="page-subtitle">Configure how Orbita connects to your Kubernetes environment.</p>
      </div>
      <div class="page-title-actions">
        <button class="button secondary" data-view="dashboard">${icon("chevron")} Back to cluster</button>
      </div>
    </div>
    <div class="settings-layout">
      <div class="settings-main">
        ${renderDiscoveryCard(s)}
        ${renderSavedConfigsCard(s)}
        ${renderAppearanceCard(s)}
      </div>
      <aside class="settings-aside">
        ${renderCliToolsCard(s)}
        ${renderHelpCard()}
      </aside>
    </div>
  </div>`;
}

defineComponent("orbita-settings", renderSettings);
