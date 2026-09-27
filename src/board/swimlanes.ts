import { NO_VALUE_SWIMLANE } from "../support/constants";

/**
 * Read the swimlane property off a file's frontmatter as a list of row
 * values. The property is treated as a list, so a card can belong to
 * multiple rows at once. A bare scalar is coerced into a single-item list.
 */
export function readRowValues(
  frontmatter: Record<string, unknown> | undefined,
  property: string,
): string[] {
  const raw = frontmatter?.[property];
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string | number | boolean =>
        ["string", "number", "boolean"].includes(typeof v),
      )
      .map((v) => String(v));
  }
  if (
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean"
  ) {
    return [String(raw)];
  }
  return [];
}

/**
 * Move a card from one swimlane row to another, keeping every other row it
 * belongs to untouched. Passing `null` for `fromRow`/`toRow` means "no
 * previous/new row membership to change".
 */
export function replaceRowValue(
  frontmatter: Record<string, unknown>,
  property: string,
  fromRow: string | null,
  toRow: string | null,
): void {
  const current = readRowValues(frontmatter, property);
  const next = current.filter(
    (row) => row !== fromRow && row !== NO_VALUE_SWIMLANE,
  );
  if (toRow && toRow !== NO_VALUE_SWIMLANE && !next.includes(toRow)) {
    next.push(toRow);
  }
  if (next.length) {
    frontmatter[property] = next;
  } else {
    delete frontmatter[property];
  }
}

/** Add a single row value to a card's swimlane list, e.g. on creation. */
export function addRowValue(
  frontmatter: Record<string, unknown>,
  property: string,
  row: string,
): void {
  if (row === NO_VALUE_SWIMLANE) return;
  const current = readRowValues(frontmatter, property);
  if (!current.includes(row)) current.push(row);
  frontmatter[property] = current;
}
