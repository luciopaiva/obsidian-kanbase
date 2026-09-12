import { describe, expect, it } from "vitest";
import {
  hasConfiguredKanbaseSettings,
  readMigratableSettings,
  selectLegacyView,
} from "../src/migration/base-board-migration";

describe("Base Board migration", () => {
  it("selects the only legacy Kanban view", () => {
    const view = { type: "kanban", name: "Old board", boardColumns: ["Todo"] };

    expect(selectLegacyView([view], "New board")).toBe(view);
  });

  it("uses an exact name match when there are multiple legacy views", () => {
    const matching = { type: "kanban", name: "Project board" };
    const other = { type: "kanban", name: "Personal board" };

    expect(selectLegacyView([other, matching], " project board ")).toBe(
      matching,
    );
  });

  it("skips ambiguous or missing legacy views", () => {
    const first = { type: "kanban", name: "Board" };
    const second = { type: "kanban", name: "Board" };

    expect(selectLegacyView([first, second], "Board")).toBeNull();
    expect(selectLegacyView([{ type: "table" }], "Board")).toBeNull();
  });

  it("copies only valid Kanbase settings", () => {
    const legacy = {
      type: "kanban",
      name: "Board",
      cardOpenBehavior: "modal",
      boardColumns: ["Todo", "Done"],
      columnColors: { Todo: "#fff" },
      filters: "must not be copied",
      groupBy: { property: "status" },
    };

    expect(readMigratableSettings(legacy)).toEqual({
      cardOpenBehavior: "modal",
      boardColumns: ["Todo", "Done"],
      columnColors: { Todo: "#fff" },
    });
  });

  it("abandons the migration when a legacy setting is malformed", () => {
    expect(
      readMigratableSettings({
        type: "kanban",
        boardColumns: ["Todo", 42],
      }),
    ).toBeNull();
  });

  it("treats false and empty collections as configured", () => {
    const config = {
      get: (key: string) =>
        key === "newCardsToTop"
          ? false
          : key === "boardColumns"
            ? []
            : undefined,
    };

    expect(hasConfiguredKanbaseSettings(config)).toBe(true);
  });
});
