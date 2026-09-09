import { describe, expect, it } from "vitest";
import {
  getTagsRequiredByFilter,
  getTagsRequiredByFilters,
} from "../src/base-filter-tags";

describe("getTagsRequiredByFilter", () => {
  it("extracts a positive tag containment filter", () => {
    expect(
      getTagsRequiredByFilter('file.tags.contains("project/base-board")'),
    ).toEqual(new Set(["project/base-board"]));
  });

  it("combines requirements in an AND group", () => {
    expect(
      getTagsRequiredByFilter({
        and: [
          'file.tags.contains("project")',
          'file.tags.contains("feature")',
          'status == "In Progress"',
        ],
      }),
    ).toEqual(new Set(["project", "feature"]));
  });

  it("keeps only requirements shared by every OR branch", () => {
    expect(
      getTagsRequiredByFilter({
        or: [
          {
            and: [
              'file.tags.contains("project")',
              'file.tags.contains("feature")',
            ],
          },
          {
            and: [
              'file.tags.contains("project")',
              'file.tags.contains("bug")',
            ],
          },
        ],
      }),
    ).toEqual(new Set(["project"]));
  });

  it("does not infer presence from negated or unsupported expressions", () => {
    expect(
      getTagsRequiredByFilter({
        not: ['file.tags.contains("archived")'],
      }),
    ).toEqual(new Set());
    expect(getTagsRequiredByFilter('file.tags.containsAny("a", "b")')).toEqual(
      new Set(),
    );
  });
});

describe("getTagsRequiredByFilters", () => {
  it("combines global and view-specific filter requirements", () => {
    expect(
      getTagsRequiredByFilters([
        'file.tags.contains("project")',
        { and: ['file.tags.contains("active")'] },
      ]),
    ).toEqual(new Set(["project", "active"]));
  });
});
