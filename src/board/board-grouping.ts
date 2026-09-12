import {
  BasesEntryGroup,
  BooleanValue,
  NumberValue,
  NullValue,
} from "obsidian";
import { NO_VALUE_COLUMN } from "../support/constants";
import { coerceColumnValue, GroupByValueType } from "../support/value-utils";

export function getColumnName(key: unknown): string {
  if (key === undefined || key === null || key instanceof NullValue) {
    return NO_VALUE_COLUMN;
  }
  if (typeof key === "object" && key !== null) {
    if ("value" in key) {
      const val = (key as Record<string, unknown>).value;
      return String(val);
    }
    // Bases group-key objects expose the column name via toString()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- Bases-controlled object with custom toString
    return String(key);
  }
  if (typeof key === "string") return key;
  if (typeof key === "number" || typeof key === "boolean") return String(key);
  return "";
}

export function getGroupByValueType(
  groups: BasesEntryGroup[],
): GroupByValueType {
  for (const group of groups) {
    if (group.key instanceof BooleanValue) return "boolean";
    if (group.key instanceof NumberValue) return "number";
  }
  return "other";
}

export function applyGroupByValue(
  fm: Record<string, unknown>,
  groupByProp: string,
  columnName: string,
  valueType: GroupByValueType,
): void {
  if (columnName === NO_VALUE_COLUMN) {
    delete fm[groupByProp];
    return;
  }
  fm[groupByProp] = coerceColumnValue(columnName, valueType);
}

export function getGroupForColumn(
  groups: BasesEntryGroup[],
  columnName: string,
): BasesEntryGroup | null {
  for (const group of groups) {
    if (getColumnName(group.key) === columnName) return group;
  }
  return null;
}
