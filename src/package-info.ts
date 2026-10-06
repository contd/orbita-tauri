import pkg from "../package.json";

/** Application metadata shown on the About page and in the status bar, derived from `package.json`. */
export interface AboutInfo {
  /** Human-friendly product name (`productName`, falling back to a capitalised package name). */
  name: string;
  /** The npm package name (`name`). */
  packageName: string;
  /** Semantic version (`version`). */
  version: string;
  /** One-line description (`description`). */
  description: string;
  /** Author's display name; empty when unset. */
  author: string;
  /** Author's email address; empty when unset. */
  email: string;
  /** Browsable repository URL with any `git+` prefix and `.git` suffix removed; empty when unset. */
  repository: string;
  /** Search keywords (`keywords`). */
  keywords: string[];
}

/** The subset of `package.json` that {@link aboutFromPackage} understands. All fields are optional. */
export interface PackageJsonLike {
  name?: string;
  productName?: string;
  version?: string;
  description?: string;
  author?: string | { name?: string; email?: string };
  repository?: string | { url?: string };
  keywords?: string[];
}

/**
 * Splits an npm-style author. Accepts an object or the `"Name <email> (url)"` string form.
 * @param author - The raw `author` field.
 * @returns The name and email, with empty strings for missing parts.
 */
function parseAuthor(author: PackageJsonLike["author"]): { author: string; email: string } {
  if (!author) return { author: "", email: "" };
  if (typeof author === "object") return { author: author.name ?? "", email: author.email ?? "" };
  const email = /<([^>]+)>/.exec(author)?.[1] ?? "";
  return { author: author.replace(/<[^>]*>|\([^)]*\)/g, "").trim(), email };
}

/**
 * Turns a repository field into a URL a person can open: drops `git+`, a trailing `.git`, and converts
 * `git://` and scp-style `git@host:path` forms to https.
 * @param repository - The raw `repository` field.
 */
function parseRepository(repository: PackageJsonLike["repository"]): string {
  const raw = typeof repository === "string" ? repository : repository?.url ?? "";
  return raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/\.git$/, "");
}

/**
 * Builds the About metadata from a `package.json` object.
 * @param source - Parsed `package.json` contents.
 * @returns Fully populated {@link AboutInfo}; missing fields become empty strings or arrays.
 */
export function aboutFromPackage(source: PackageJsonLike): AboutInfo {
  const packageName = source.name ?? "";
  const fallback = packageName.replace(/-tauri$/, "").replace(/^./, c => c.toUpperCase());
  return {
    name: source.productName?.replace(/\s+Tauri$/, "") || fallback || "Orbita",
    packageName,
    version: source.version ?? "",
    description: source.description ?? "",
    ...parseAuthor(source.author),
    repository: parseRepository(source.repository),
    keywords: source.keywords ?? [],
  };
}

/** About metadata read from the bundled `package.json` at startup; no host call is needed. */
export const packageInfo: AboutInfo = aboutFromPackage(pkg as PackageJsonLike);
