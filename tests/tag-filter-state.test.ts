import { describe, expect, it } from "vitest";
import {
  getNextTagFilterState,
  matchesTagFilters,
  type ActiveTagFilterState,
} from "../src/tag-filter-state";

describe("getNextTagFilterState", () => {
  it("cycles from none to include to exclude and back to none", () => {
    expect(getNextTagFilterState("none")).toBe("include");
    expect(getNextTagFilterState("include")).toBe("exclude");
    expect(getNextTagFilterState("exclude")).toBe("none");
  });
});

describe("matchesTagFilters", () => {
  it("matches every card when no filters are active", () => {
    expect(matchesTagFilters(["feature"], new Map())).toBe(true);
  });

  it("preserves OR matching across include filters", () => {
    const filters = new Map<string, ActiveTagFilterState>([
      ["feature", "include"],
      ["bug", "include"],
    ]);

    expect(matchesTagFilters(["feature"], filters)).toBe(true);
    expect(matchesTagFilters(["bug"], filters)).toBe(true);
    expect(matchesTagFilters(["docs"], filters)).toBe(false);
  });

  it("rejects cards containing an excluded tag", () => {
    const filters = new Map<string, ActiveTagFilterState>([
      ["archived", "exclude"],
    ]);

    expect(matchesTagFilters(["feature"], filters)).toBe(true);
    expect(matchesTagFilters(["feature", "archived"], filters)).toBe(false);
  });

  it("applies exclusions after an include match", () => {
    const filters = new Map<string, ActiveTagFilterState>([
      ["feature", "include"],
      ["archived", "exclude"],
    ]);

    expect(matchesTagFilters(["feature"], filters)).toBe(true);
    expect(matchesTagFilters(["feature", "archived"], filters)).toBe(false);
    expect(matchesTagFilters(["docs"], filters)).toBe(false);
  });
});
