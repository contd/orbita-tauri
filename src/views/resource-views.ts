import { definitions, type ResourceKey } from "../kubernetes";
import { defineComponent } from "../components/base";
import { renderResourceTable } from "../components/resource-table";
import type { RenderState } from "../components/types";

/** Custom-element tag name for one resource view key. */
const tagFor = (key: ResourceKey): string => `orbita-view-${key}`;

/** Per-resource custom-element tag used by the renderer. */
export const resourceViewTags: Record<ResourceKey, string> = definitions.reduce((acc, def) => {
  acc[def.key] = tagFor(def.key);
  return acc;
}, {} as Record<ResourceKey, string>);

/** Type guard for resource-view keys used in route/view checks. */
export function isResourceView(name: string): name is ResourceKey {
  return Object.prototype.hasOwnProperty.call(resourceViewTags, name);
}

for (const def of definitions) {
  defineComponent(resourceViewTags[def.key], (s: RenderState) => renderResourceTable(s, def.key));
}
