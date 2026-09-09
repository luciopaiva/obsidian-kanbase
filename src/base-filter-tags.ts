import type { BasesConfigFileFilter } from "obsidian";

const TAG_CONTAINS_PATTERN =
  /^\s*file\.tags\.contains\(\s*("(?:\\.|[^"\\])*")\s*\)\s*$/;

function intersectSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const intersection = new Set(sets[0]);
  for (const set of sets.slice(1)) {
    for (const value of intersection) {
      if (!set.has(value)) intersection.delete(value);
    }
  }
  return intersection;
}

/**
 * Return tags that a serialized Bases filter logically requires every result
 * to contain. Unsupported expressions are ignored rather than guessed at.
 */
export function getTagsRequiredByFilter(
  filter: BasesConfigFileFilter | undefined,
): Set<string> {
  if (!filter) return new Set();

  if (typeof filter === "string") {
    const match = filter.match(TAG_CONTAINS_PATTERN);
    if (!match) return new Set();

    try {
      const tag = JSON.parse(match[1]) as unknown;
      if (typeof tag !== "string" || tag.length === 0) return new Set();
      return new Set([tag.startsWith("#") ? tag.slice(1) : tag]);
    } catch {
      return new Set();
    }
  }

  if ("and" in filter) {
    const required = new Set<string>();
    for (const child of filter.and) {
      for (const tag of getTagsRequiredByFilter(child)) required.add(tag);
    }
    return required;
  }

  if ("or" in filter) {
    return intersectSets(filter.or.map(getTagsRequiredByFilter));
  }

  // A negated tag predicate guarantees absence, not presence.
  return new Set();
}

/** Global and view filters are applied together, so their requirements add. */
export function getTagsRequiredByFilters(
  filters: Iterable<BasesConfigFileFilter>,
): Set<string> {
  const required = new Set<string>();
  for (const filter of filters) {
    for (const tag of getTagsRequiredByFilter(filter)) required.add(tag);
  }
  return required;
}
