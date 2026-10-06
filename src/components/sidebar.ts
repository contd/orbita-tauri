import { definitions, escapeHtml, groups } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";

/** Dashboard entry shown at the top of the Cluster group. */
function renderDashboardItem(s: RenderState): string {
  return `
        <button class="nav-item ${s.view === "dashboard" ? "active" : ""}" data-view="dashboard" title="Dashboard" aria-label="Dashboard">
          <span class="nav-icon">${icon("grid")}</span>
          <span class="nav-label">Dashboard</span>
        </button>`;
}

/** One resource entry with its optional loaded-count badge. */
function renderNavItem(s: RenderState, d: (typeof definitions)[number]): string {
  const count = s.loaded.has(d.key) ? s.snapshot[d.key]?.length ?? 0 : 0;
  const active = s.view === d.key;
  return `
        <button class="nav-item ${active ? "active" : ""}" data-view="${d.key}" title="${escapeHtml(d.label)}" aria-label="${escapeHtml(d.label)}">
          <span class="nav-icon">${escapeHtml(d.icon)}</span>
          <span class="nav-label">${escapeHtml(d.label)}</span>
          ${count ? `<span class="nav-count">${count}</span>` : ""}
        </button>`;
}

/** A collapsible group of navigation items. */
function renderGroup(s: RenderState, group: string): string {
  const folded = !s.sidebarCollapsed && s.collapsed.has(group);
  const items = folded
    ? ""
    : [
        group === "Cluster" ? renderDashboardItem(s) : "",
        ...definitions.filter(d => d.group === group).map(d => renderNavItem(s, d)),
      ].join("");
  return `
    <section class="nav-group">
      <button class="group-heading" data-action="toggle-group" data-group="${escapeHtml(group)}" aria-expanded="${!folded}">
        <span>${escapeHtml(group)}</span>
        <span class="group-chevron ${folded ? "folded" : ""}">${icon("chevron")}</span>
      </button>${items}
    </section>`;
}

/** Sidebar: brand, cluster card, grouped navigation and settings. */
export function renderSidebar(s: RenderState): string {
  const toggleLabel = s.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  return `<aside class="sidebar ${s.sidebarCollapsed ? "sidebar-collapsed" : ""}">
    <button class="sidebar-toggle" data-action="toggle-sidebar" aria-expanded="${!s.sidebarCollapsed}" aria-label="${toggleLabel}" title="${toggleLabel}">${icon("chevron")}</button>

    <div class="brand">
      <div class="brand-mark">${icon("cluster")}</div>
      <div><strong>orbita</strong><span>CLUSTER CONSOLE</span></div>
    </div>

    <div class="cluster-card">
      <orbita-context-select></orbita-context-select>
      <button class="nav-add-config" data-action="add-config" title="Add kubeconfig" aria-label="Add kubeconfig">${icon("plus")} <span class="nav-label">Add kubeconfig</span></button>
    </div>

    <div class="nav-scroll">${groups.map(g => renderGroup(s, g)).join("")}
    </div>

    <div class="sidebar-bottom">
      <button class="nav-item ${s.view === "settings" ? "active" : ""}" data-view="settings" title="Settings" aria-label="Settings">
        <span class="nav-icon">${icon("settings")}</span>
        <span class="nav-label">Settings</span>
      </button>
    </div>
  </aside>`;
}

defineComponent("orbita-sidebar", renderSidebar);
