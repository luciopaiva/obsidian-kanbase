import { describe, expect, it } from "vitest";
import {
  addRowValue,
  readRowValues,
  replaceRowValue,
} from "../src/board/swimlanes";

describe("swimlane row values", () => {
  it("reads a list property as an array of strings", () => {
    expect(readRowValues({ lanes: ["Alice", "Bob"] }, "lanes")).toEqual([
      "Alice",
      "Bob",
    ]);
  });

  it("coerces a bare scalar into a single-item list", () => {
    expect(readRowValues({ lanes: "Alice" }, "lanes")).toEqual(["Alice"]);
    expect(readRowValues({ lanes: 3 }, "lanes")).toEqual(["3"]);
  });

  it("returns an empty list when the property is absent", () => {
    expect(readRowValues({}, "lanes")).toEqual([]);
    expect(readRowValues(undefined, "lanes")).toEqual([]);
  });

  it("adds a row value without disturbing existing ones", () => {
    const fm: Record<string, unknown> = { lanes: ["Alice"] };
    addRowValue(fm, "lanes", "Bob");
    expect(fm.lanes).toEqual(["Alice", "Bob"]);
  });

  it("does not duplicate a row value already present", () => {
    const fm: Record<string, unknown> = { lanes: ["Alice"] };
    addRowValue(fm, "lanes", "Alice");
    expect(fm.lanes).toEqual(["Alice"]);
  });

  it("replaces one row with another, keeping the rest untouched", () => {
    const fm: Record<string, unknown> = { lanes: ["Alice", "Bob", "Carol"] };
    replaceRowValue(fm, "lanes", "Bob", "Dave");
    expect(fm.lanes).toEqual(["Alice", "Carol", "Dave"]);
  });

  it("just removes the row when moving to no value", () => {
    const fm: Record<string, unknown> = { lanes: ["Alice", "Bob"] };
    replaceRowValue(fm, "lanes", "Bob", null);
    expect(fm.lanes).toEqual(["Alice"]);
  });

  it("deletes the property entirely once the list becomes empty", () => {
    const fm: Record<string, unknown> = { lanes: ["Bob"] };
    replaceRowValue(fm, "lanes", "Bob", null);
    expect(fm.lanes).toBeUndefined();
  });

  it("just adds the row when there was no previous membership", () => {
    const fm: Record<string, unknown> = {};
    replaceRowValue(fm, "lanes", null, "Alice");
    expect(fm.lanes).toEqual(["Alice"]);
  });
});
