import { BasesEntryGroup, BasesViewConfig } from "obsidian";
import {
  CONFIG_KEY_ADD_TO_TOP,
  CONFIG_KEY_COVER_PROPERTY,
  CONFIG_KEY_OPEN_BEHAVIOR,
} from "../support/constants";
import { applyGroupByValue, getGroupByValueType } from "./board-grouping";

export type CardOpenBehavior = "active" | "modal" | "split" | "tab";

export class BoardConfig {
  constructor(
    private readonly getConfig: () => BasesViewConfig | undefined,
    private readonly groups: () => BasesEntryGroup[],
    private readonly onChange: () => void,
  ) {}

  public getGroupByProperty(): string | null {
    const cfg = this.getConfig() as
      | { groupBy?: { property?: string }; get(key: string): unknown }
      | undefined;
    const groupBy = cfg?.groupBy;
    if (groupBy?.property) return this.stripNotePrefix(groupBy.property);

    const fromGet = cfg?.get("groupBy") as { property?: string } | undefined;
    if (fromGet?.property) return this.stripNotePrefix(fromGet.property);
    return null;
  }

  public getCardOpenBehavior(): CardOpenBehavior {
    const value = this.getConfig()?.get(CONFIG_KEY_OPEN_BEHAVIOR);
    if (value === "modal" || value === "split" || value === "tab") {
      return value;
    }
    return "active";
  }

  public setCardOpenBehavior(behavior: CardOpenBehavior): void {
    this.getConfig()?.set(CONFIG_KEY_OPEN_BEHAVIOR, behavior);
    this.onChange();
  }

  public getCardCoverProperty(): string | null {
    const value = this.getConfig()?.get(CONFIG_KEY_COVER_PROPERTY);
    if (value === undefined || value === null) return "cover";
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : null;
  }

  public setCardCoverProperty(property: string): void {
    this.getConfig()?.set(CONFIG_KEY_COVER_PROPERTY, property);
    this.onChange();
  }

  public shouldAddNewCardsToTop(): boolean {
    return this.getConfig()?.get(CONFIG_KEY_ADD_TO_TOP) === true;
  }

  public setAddNewCardsToTop(value: boolean): void {
    this.getConfig()?.set(CONFIG_KEY_ADD_TO_TOP, value);
    this.onChange();
  }

  public applyGroupByValue(
    fm: Record<string, unknown>,
    groupByProp: string,
    columnName: string,
  ): void {
    applyGroupByValue(
      fm,
      groupByProp,
      columnName,
      getGroupByValueType(this.groups()),
    );
  }

  public ensureFileNameInOrder(): void {
    const config = this.getConfig();
    if (!config) return;
    const currentOrder = (config.get("order") as string[] | undefined) ?? [];
    if (
      !currentOrder.includes("file.name") &&
      !currentOrder.includes("file.file")
    ) {
      config.set("order", ["file.name", ...currentOrder]);
    }
  }

  private stripNotePrefix(property: string): string {
    return property.startsWith("note.") ? property.slice(5) : property;
  }
}
