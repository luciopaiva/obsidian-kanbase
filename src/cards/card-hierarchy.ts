import type { App } from "obsidian";

/**
 * Build the wikilink stored in a child card's `kanbase_parent` frontmatter
 * property,
 * e.g. "Tasks/IV work.md" → "[[Tasks/IV work]]".
 */
export function makeParentLink(parentPath: string): string {
  return `[[${parentPath.replace(/\.md$/i, "")}]]`;
}

/**
 * Read the raw frontmatter value of the `kanbase_parent` property and return
 * the link target it points at (a path or a linktext). Accepts plain strings as well as
 * wikilinks with or without an alias, and the first usable entry of a list.
 */
export function readParentTarget(raw: unknown): string | null {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const target = readParentTarget(item);
      if (target) return target;
    }
    return null;
  }
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  const target = (match ? match[1] : raw).trim();
  return target === "" ? null : target;
}

/** Resolve a card's `kanbase_parent` property to an absolute vault path. */
export function resolveParentPath(
  app: App,
  sourcePath: string,
  raw: unknown,
): string | null {
  const target = readParentTarget(raw);
  if (!target) return null;
  const resolved = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  return resolved ? resolved.path : null;
}

/** Human-readable name of a card's parent note, or null when it has none. */
export function getParentDisplayName(
  app: App,
  sourcePath: string,
  raw: unknown,
): string | null {
  const target = readParentTarget(raw);
  if (!target) return null;
  const resolved = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  if (resolved) return resolved.basename;
  const lastSegment = target.split("/").pop() ?? target;
  return lastSegment.replace(/\.md$/i, "");
}
