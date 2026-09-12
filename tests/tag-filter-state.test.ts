import { describe, expect, it } from "vitest";
import {
  getDesktopTagFilterState,
  getNextTagFilterState,
  matchesTagFilters,
  type ActiveTagFilterState,
} from "../src/tags/tag-filter-state";

describe("getNextTagFilterState", () => {
  it("cycles from none to include to exclude and back to none", () => {
    expect(getNextTagFilterState("none")).toBe("include");
    expect(getNextTagFilterState("include")).toBe("exclude");
    expect(getNextTagFilterState("exclude")).toBe("none");
  });

  it("uses direct include and clear actions for desktop clicks", () => {
    expect(getDesktopTagFilterState("none", false)).toBe("include");
    expect(getDesktopTagFilterState("include", false)).toBe("none");
    expect(getDesktopTagFilterState("exclude", false)).toBe("none");
  });

  it("uses direct exclude and clear actions for shift-clicks", () => {
    expect(getDesktopTagFilterState("none", true)).toBe("exclude");
    expect(getDesktopTagFilterState("include", true)).toBe("exclude");
    expect(getDesktopTagFilterState("exclude", true)).toBe("none");
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
