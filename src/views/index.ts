import type { View } from "../components/types";
import { isResourceView, resourceViewTags } from "./resource-views";

const fixedViewTags: Record<Exclude<View, keyof typeof resourceViewTags>, string> = {
  dashboard: "orbita-dashboard",
  settings: "orbita-settings",
  about: "orbita-about",
};

/** Resolves the custom-element tag that renders a given view key. */
export function viewTag(view: View): string {
  return isResourceView(view) ? resourceViewTags[view] : fixedViewTags[view];
}

/** Type guard for any valid app view name. */
export function isAppViewName(name: string): name is View {
  return Object.prototype.hasOwnProperty.call(fixedViewTags, name) || isResourceView(name);
}

export { isResourceView, resourceViewTags };
