export type ActiveTagFilterState = "include" | "exclude";
export type TagFilterState = ActiveTagFilterState | "none";

export function getNextTagFilterState(state: TagFilterState): TagFilterState {
  if (state === "none") return "include";
  if (state === "include") return "exclude";
  return "none";
}

export function matchesTagFilters(
  fileTags: readonly string[],
  filters: ReadonlyMap<string, ActiveTagFilterState>,
): boolean {
  let hasIncludeFilter = false;
  let matchesIncludeFilter = false;

  for (const [tag, state] of filters) {
    const hasTag = fileTags.includes(tag);
    if (state === "exclude" && hasTag) return false;
    if (state === "include") {
      hasIncludeFilter = true;
      if (hasTag) matchesIncludeFilter = true;
    }
  }

  return !hasIncludeFilter || matchesIncludeFilter;
}
