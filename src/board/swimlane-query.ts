import { BasesEntry, TFile } from "obsidian";
import { NO_VALUE_SWIMLANE } from "../support/constants";
import { readRowValues } from "./swimlanes";
import type { KanbanView } from "../kanban-view";

/**
 * App-dependent helpers that resolve a `BasesEntry`'s swimlane row
 * membership via the vault/metadata cache. Kept separate from
 * `swimlanes.ts` so the pure frontmatter-list logic there stays unit
 * testable without an Obsidian runtime.
 */

export function getEntryRowValues(
  view: KanbanView,
  entry: BasesEntry,
  property: string,
): string[] {
  const path = entry.file?.path;
  if (!path) return [];
  const file = view.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return [];
  const cache = view.app.metadataCache.getFileCache(file);
  const values = readRowValues(cache?.frontmatter, property);
  return values.length ? values : [NO_VALUE_SWIMLANE];
}

/** Distinct row values across entries, in first-seen order. */
export function discoverRows(
  view: KanbanView,
  entries: BasesEntry[],
  property: string,
): string[] {
  const rows: string[] = [];
  for (const entry of entries) {
    for (const row of getEntryRowValues(view, entry, property)) {
      if (!rows.includes(row)) rows.push(row);
    }
  }
  return rows;
}

/**
 * Partition entries by row value. An entry can appear under more than one
 * row when its property list contains multiple values.
 */
export function partitionEntriesByRow(
  view: KanbanView,
  entries: BasesEntry[],
  property: string,
): Map<string, BasesEntry[]> {
  const byRow = new Map<string, BasesEntry[]>();
  for (const entry of entries) {
    for (const row of getEntryRowValues(view, entry, property)) {
      const bucket = byRow.get(row);
      if (bucket) {
        bucket.push(entry);
      } else {
        byRow.set(row, [entry]);
      }
    }
  }
  return byRow;
}
