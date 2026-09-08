import { describe, expect, it } from "vitest";
import { countTagsByCard } from "../src/tag-counts";

describe("countTagsByCard", () => {
  it("counts the cards containing each tag", () => {
    const counts = countTagsByCard([
      ["feature", "ui"],
      ["bug", "ui"],
      ["feature"],
      [],
    ]);

    expect(Object.fromEntries(counts)).toEqual({
      feature: 2,
      ui: 2,
      bug: 1,
    });
  });

  it("counts a duplicate tag only once per card", () => {
    const counts = countTagsByCard([
      ["testing", "testing"],
      ["testing"],
    ]);

    expect(counts.get("testing")).toBe(2);
  });
});
