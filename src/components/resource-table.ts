import { compareValues, definitions, escapeHtml, getDef, identity, labelSummary, rowStatus, statusTone, type Resource, type ResourceKey } from "../kubernetes";
import { defineComponent } from "./base";
import { icon } from "./icons";
import type { RenderState } from "./types";
import { logKinds } from "./types";

const ACTION_COLUMN_LABEL = "Actions";
const NAMESPACE_LABEL_PREVIEW_LIMIT = 100;

type TableColumn = {
  label: string;
  status?: boolean;
  value: (resource: Resource) => string;
};

const nameColumn: TableColumn = {
  label: "Name",
  value: resource => resource.metadata.name,
};

/** Resolves the active resource key from an explicit key or current view. */
function resolveKey(s: RenderState, key?: ResourceKey): ResourceKey | null {
  if (key) return key;
  return definitions.some(def => def.key === s.view) ? (s.view as ResourceKey) : null;
}

/** Returns whether a specific column is currently sorted. */
function isSortedBy(s: RenderState, column: TableColumn): boolean {
  return s.sort.column === column.label;
}

/** Widths configured for the active resource table, including the actions column. */
function tableColumnWidths(s: RenderState, key: ResourceKey, count: number): Array<number | undefined> {
  const saved = s.tableColumnWidths[key] ?? [];
  return Array.from({ length: count }, (_value, index) => {
    const width = saved[index];
    return Number.isFinite(width) && width > 0 ? width : undefined;
  });
}

/** Inline table width when every column width is known, so drag math stays deterministic. */
function tableWidthStyle(widths: Array<number | undefined>): string {
  if (widths.some(width => !width)) return "";
  let total = 0;
  for (const width of widths) total += Number(width ?? 0);
  return total > 0 ? ` style="width:${Math.round(total)}px"` : "";
}

/** Labels and numeric values are sorted naturally; status columns use derived status text. */
function sortableValue(resource: Resource, key: ResourceKey, column: TableColumn): string {
  if (column.label === "Name") return resource.metadata.name;
  if (column.status || column.label.toLowerCase() === "status") return rowStatus(resource, key);
  return column.value(resource);
}

/** Full row text used by search; keeps filtering broad and intuitive. */
function searchableText(resource: Resource, key: ResourceKey, columns: TableColumn[]): string {
  const labels = Object.entries(resource.metadata.labels ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  const values = columns.map(column => sortableValue(resource, key, column)).join(" ");
  return [resource.kind, resource.metadata.name, resource.metadata.namespace ?? "", labels, values].join(" ").toLowerCase();
}

/** Namespace/search/sort pipeline used by both rendering and tests. */
export function filteredResources(s: RenderState, key: ResourceKey): Resource[] {
  const definition = getDef(key);
  const columns: TableColumn[] = [nameColumn, ...definition.columns];
  const namespace = s.settings.namespace;
  const query = s.search.trim().toLowerCase();

  const filtered = (s.snapshot[key] ?? []).filter(resource => {
    const inNamespace = !definition.namespaced || namespace === "All namespaces" || resource.metadata.namespace === namespace;
    if (!inNamespace) return false;
    if (!query) return true;
    return searchableText(resource, key, columns).includes(query);
  });

  const sortedColumn = columns.find(column => column.label === s.sort.column) ?? nameColumn;
  return [...filtered].sort((a, b) => s.sort.direction * compareValues(sortableValue(a, key, sortedColumn), sortableValue(b, key, sortedColumn)));
}

function renderSortButton(s: RenderState, column: TableColumn): string {
  const sorted = isSortedBy(s, column);
  const sortArrow = sorted ? (s.sort.direction === 1 ? "↑" : "↓") : "";
  return `<button class="sort-button" data-sort="${escapeHtml(column.label)}" aria-label="Sort by ${escapeHtml(column.label)}">
    ${escapeHtml(column.label)}
    ${sorted ? `<span>${sortArrow}</span>` : ""}
  </button>`;
}

function renderColumnResizer(key: ResourceKey, index: number, label: string, width?: number): string {
  const value = width ? ` aria-valuenow="${Math.round(width)}"` : "";
  return `<span class="table-col-resizer" role="separator" aria-orientation="vertical" aria-label="Resize ${escapeHtml(label)} column" aria-valuemin="24"${value} tabindex="0" data-resource-key="${key}" data-column-index="${index}"></span>`;
}

function renderHeaderCell(s: RenderState, key: ResourceKey, column: TableColumn, index: number, width?: number): string {
  return `<th>
    <div class="column-header-content">${renderSortButton(s, column)}</div>
    ${renderColumnResizer(key, index, column.label, width)}
  </th>`;
}

function renderActionHeader(key: ResourceKey, index: number, width?: number): string {
  return `<th class="action-header">
    ${renderColumnResizer(key, index, ACTION_COLUMN_LABEL, width)}
  </th>`;
}

function renderStatusCell(status: string): string {
  return `<span class="status-cell ${statusTone(status)}"><i></i>${escapeHtml(status)}</span>`;
}

function namespaceLabelPreview(text: string): { preview: string; truncated: boolean } {
  if (text.length <= NAMESPACE_LABEL_PREVIEW_LIMIT) return { preview: text, truncated: false };
  return { preview: `${text.slice(0, NAMESPACE_LABEL_PREVIEW_LIMIT)}...`, truncated: true };
}

function renderLabelsCell(resource: Resource, key: ResourceKey): string {
  const labels = labelSummary(resource.metadata.labels);
  if (key !== "namespaces") return `<td><span class="label-summary">${escapeHtml(labels)}</span></td>`;
  const { preview, truncated } = namespaceLabelPreview(labels);
  if (!truncated) return `<td><span class="label-summary namespace-label-summary">${escapeHtml(preview)}</span></td>`;
  return `<td><span class="label-summary namespace-label-summary" data-full-labels="${escapeHtml(labels)}" title="${escapeHtml(labels)}">${escapeHtml(preview)}</span></td>`;
}

function avatarToneClass(key: ResourceKey): string {
  const group = getDef(key).group.toLowerCase().replace(/\s+/g, "-");
  return ["workloads", "network", "access-control", "configuration", "storage", "observability"].includes(group) ? ` ${group}` : "";
}

function renderNameCell(resource: Resource, key: ResourceKey): string {
  const id = identity(resource);
  const openerId = `row-log-${id}`;
  return `<div class="name-cell">
    <span class="resource-avatar${avatarToneClass(key)}">${escapeHtml(getDef(key).icon)}</span>
    <div>
      <strong>${escapeHtml(resource.metadata.name)}</strong>
      <small>${escapeHtml(resource.metadata.namespace ?? "Cluster-scoped")}</small>
    </div>
    <div class="name-actions">
      ${logKinds.has(key) ? `<button class="name-action" data-action="open-logs" data-id="${escapeHtml(id)}" data-log-opener="${escapeHtml(openerId)}" aria-label="Open logs for ${escapeHtml(resource.kind)} ${escapeHtml(resource.metadata.name)}">Logs</button>` : ""}
      <button class="name-action" data-action="open-resource" data-id="${escapeHtml(id)}" aria-label="Inspect ${escapeHtml(resource.kind)} ${escapeHtml(resource.metadata.name)}">Inspect</button>
    </div>
  </div>`;
}

function renderColumnCell(resource: Resource, key: ResourceKey, column: TableColumn): string {
  if (column.label === "Name") return `<td>${renderNameCell(resource, key)}</td>`;
  if (column.status || column.label.toLowerCase() === "status") return `<td>${renderStatusCell(rowStatus(resource, key))}</td>`;
  if (column.label === "Labels") return renderLabelsCell(resource, key);
  if (column.label === "Containers") {
    const total = resource.containerNames?.length ?? 0;
    const ready = resource.readyContainers ?? 0;
    const bars = Array.from({ length: total }, (_, index) => `<i class="${index < ready ? "" : "not-ready"}"></i>`).join("");
    return `<td><div class="container-squares">${bars}<small>${ready}/${total}</small></div></td>`;
  }
  const text = column.value(resource);
  const numeric = /^-?\d+(\.\d+)?$/.test(text) ? " numeric-cell" : "";
  return `<td class="${numeric.trim()}">${escapeHtml(text)}</td>`;
}

function renderActionsCell(resource: Resource): string {
  return `<td><button class="row-more" data-action="open-resource" data-id="${escapeHtml(identity(resource))}" aria-label="Inspect ${escapeHtml(resource.kind)} ${escapeHtml(resource.metadata.name)}">${icon("inspect")}</button></td>`;
}

function renderRow(s: RenderState, resource: Resource, key: ResourceKey, columns: TableColumn[]): string {
  const rowId = identity(resource);
  const selected = s.inspector?.metadata.uid === resource.metadata.uid ? "true" : "false";
  return `<tr class="resource-row" data-selected="${selected}" tabindex="0" data-resource="${escapeHtml(rowId)}" aria-label="Inspect ${escapeHtml(resource.kind)} ${escapeHtml(resource.metadata.name)}">
    ${columns.map(column => renderColumnCell(resource, key, column)).join("")}
    ${renderActionsCell(resource)}
  </tr>`;
}

function renderEmptyState(s: RenderState, key: ResourceKey): string {
  const definition = getDef(key);
  return `<div class="panel empty-state">
    <span>${escapeHtml(definition.icon)}</span>
    <strong>No resources found</strong>
    <p>Try a different search term or namespace for ${escapeHtml(definition.label.toLowerCase())}.</p>
    ${s.search ? `<button class="button secondary" data-action="clear-search">Clear search</button>` : ""}
  </div>`;
}

/** Resource table page used by resource-view custom elements and test helpers. */
export function renderResourceTable(s: RenderState, forceKey?: ResourceKey): string {
  const key = resolveKey(s, forceKey);
  if (!key) return "";

  const definition = getDef(key);
  const columns: TableColumn[] = [nameColumn, ...definition.columns];
  const totalColumns = columns.length + 1;
  const widths = tableColumnWidths(s, key, totalColumns);
  const rows = filteredResources(s, key);
  const total = (s.snapshot[key] ?? []).length;
  const loading = s.loadingCollections.has(key);
  const countText = loading ? "Loading…" : `${rows.length} resources`;

  if (!rows.length) {
    return `<div class="page-content resource-page">
      <div class="page-title-row">
        <div><div class="eyebrow">KUBERNETES <span>·</span> ${escapeHtml(definition.group.toUpperCase())}</div><h1>${escapeHtml(definition.label)}</h1></div>
        <div class="resource-count">${countText}</div>
      </div>
      ${renderEmptyState(s, key)}
    </div>`;
  }

  return `<div class="page-content resource-page">
    <div class="page-title-row">
      <div><div class="eyebrow">KUBERNETES <span>·</span> ${escapeHtml(definition.group.toUpperCase())}</div><h1>${escapeHtml(definition.label)}</h1></div>
      <div class="resource-count">${countText}</div>
    </div>
    <div class="table-toolbar">
      <div class="table-context">
        <span class="context-symbol">${escapeHtml(definition.icon)}</span>
        <span>${escapeHtml(definition.group)}</span>
      </div>
      <div class="table-tools">
        <span class="data-count">${countText}</span>
      </div>
    </div>
    <div class="table-shell">
      <table class="resource-table-grid" data-resource-key="${key}"${tableWidthStyle(widths)}>
        <colgroup>
          ${widths.map((width, index) => `<col data-column-index="${index}"${width ? ` style="width:${Math.round(width)}px"` : ""}>`).join("")}
        </colgroup>
        <thead>
          <tr>
            ${columns.map((column, index) => renderHeaderCell(s, key, column, index, widths[index])).join("")}
            ${renderActionHeader(key, columns.length, widths[columns.length])}
          </tr>
        </thead>
        <tbody>
          ${rows.map(resource => renderRow(s, resource, key, columns)).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-foot">
      <span>Showing <strong>${rows.length}</strong> of <strong>${total}</strong></span>
      <span>Namespace: <strong>${escapeHtml(s.settings.namespace)}</strong></span>
    </div>
  </div>`;
}

defineComponent("orbita-resource-table", renderResourceTable);
