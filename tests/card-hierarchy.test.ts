import { describe, expect, it } from "vitest";
import type { App, TFile } from "obsidian";
import {
  getParentDisplayName,
  makeParentLink,
  readParentTarget,
  resolveParentPath,
} from "../src/cards/card-hierarchy";

function fakeApp(resolved: Record<string, string>): App {
  return {
    metadataCache: {
      getFirstLinkpathDest: (target: string) => {
        const path = resolved[target];
        if (!path) return null;
        const basename = path.split("/").pop()!.replace(/\.md$/, "");
        return { path, basename } as TFile;
      },
    },
  } as unknown as App;
}

describe("makeParentLink", () => {
  it("builds a wikilink without the .md extension", () => {
    expect(makeParentLink("Tasks/IV work.md")).toBe("[[Tasks/IV work]]");
  });

  it("keeps paths without an extension as-is", () => {
    expect(makeParentLink("Tasks/IV work")).toBe("[[Tasks/IV work]]");
  });
});

describe("readParentTarget", () => {
  it("reads a wikilink target", () => {
    expect(readParentTarget("[[Tasks/IV work]]")).toBe("Tasks/IV work");
  });

  it("drops the alias from a wikilink", () => {
    expect(readParentTarget("[[Tasks/IV work|Journal]]")).toBe("Tasks/IV work");
  });

  it("accepts a plain path", () => {
    expect(readParentTarget("Tasks/IV work")).toBe("Tasks/IV work");
  });

  it("uses the first usable entry of a list", () => {
    expect(readParentTarget([null, "", "[[Other]]"])).toBe("Other");
  });

  it("returns null for missing or unusable values", () => {
    expect(readParentTarget(undefined)).toBeNull();
    expect(readParentTarget(null)).toBeNull();
    expect(readParentTarget(42)).toBeNull();
    expect(readParentTarget("")).toBeNull();
    expect(readParentTarget("   ")).toBeNull();
  });
});

describe("resolveParentPath", () => {
  it("resolves the link against the vault", () => {
    const app = fakeApp({ "Tasks/IV work": "Tasks/IV work.md" });
    expect(resolveParentPath(app, "Tasks/child.md", "[[Tasks/IV work]]")).toBe(
      "Tasks/IV work.md",
    );
  });

  it("returns null when there is no parent or no match", () => {
    const app = fakeApp({});
    expect(resolveParentPath(app, "Tasks/child.md", null)).toBeNull();
    expect(resolveParentPath(app, "Tasks/child.md", "[[Missing]]")).toBeNull();
  });
});

describe("getParentDisplayName", () => {
  it("uses the resolved file's basename", () => {
    const app = fakeApp({ "Tasks/IV work": "Tasks/IV work.md" });
    expect(
      getParentDisplayName(app, "Tasks/child.md", "[[Tasks/IV work]]"),
    ).toBe("IV work");
  });

  it("falls back to the linktext when it cannot be resolved", () => {
    const app = fakeApp({});
    expect(
      getParentDisplayName(app, "Tasks/child.md", "[[Tasks/IV work]]"),
    ).toBe("IV work");
    expect(getParentDisplayName(app, "Tasks/child.md", null)).toBeNull();
  });
});
