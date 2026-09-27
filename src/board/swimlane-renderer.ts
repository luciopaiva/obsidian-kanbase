import { BasesEntry, Menu, setIcon } from "obsidian";
import type { KanbanView } from "../kanban-view";
import { getGroupForColumn } from "./board-grouping";
import { discoverRows, partitionEntriesByRow } from "./swimlane-query";
import { NO_VALUE_SWIMLANE } from "../support/constants";

/**
 * Renders the board split into swimlane rows when a swimlane property is
 * configured. Each row repeats the full set of columns, scoped to only the
 * cards whose swimlane property list contains that row's value.
 */
export class SwimlaneManager {
  private lastRenderedRows: string[] = [];

  constructor(private readonly view: KanbanView) {}

  public render(
    boardEl: HTMLElement,
    columns: string[],
    property: string,
  ): void {
    const entriesByColumn = new Map<string, BasesEntry[]>();
    const allEntries: BasesEntry[] = [];
    for (const columnName of columns) {
      const group = getGroupForColumn(this.view.currentGroups, columnName);
      const entries = this.view.cardMoves.getEntriesForColumn(
        columnName,
        group,
      );
      entriesByColumn.set(columnName, entries);
      allEntries.push(...entries);
    }

    const discovered = discoverRows(this.view, allEntries, property);
    const rows = this.view.preferences.getSwimlaneRows(discovered);
    this.lastRenderedRows = rows;

    rows.forEach((rowValue) => {
      this.renderRow(boardEl, rowValue, columns, entriesByColumn, property);
    });
  }

  private renderRow(
    boardEl: HTMLElement,
    rowValue: string,
    columns: string[],
    entriesByColumn: Map<string, BasesEntry[]>,
    property: string,
  ): void {
    const isCollapsed = this.view.preferences.isSwimlaneCollapsed(rowValue);
    const rowEl = boardEl.createDiv({ cls: "kanbase-swimlane-row" });
    rowEl.dataset.swimlaneRow = rowValue;
    rowEl.classList.toggle("kanbase-swimlane-row--collapsed", isCollapsed);

    const headerEl = rowEl.createDiv({ cls: "kanbase-swimlane-header" });
    headerEl.setAttr("draggable", "true");
    headerEl.addEventListener("click", () => {
      if (isCollapsed) this.view.preferences.toggleSwimlaneCollapsed(rowValue);
    });

    const dragHandle = headerEl.createDiv({
      cls: "kanbase-swimlane-drag-handle",
    });
    setIcon(dragHandle, "grip-vertical");

    const collapseBtn = headerEl.createDiv({
      cls: "kanbase-swimlane-collapse-btn",
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": isCollapsed ? "Expand row" : "Collapse row",
      },
    });
    setIcon(collapseBtn, isCollapsed ? "chevron-right" : "chevron-down");
    const toggleCollapsed = (e: Event) => {
      e.stopPropagation();
      this.view.preferences.toggleSwimlaneCollapsed(rowValue);
    };
    collapseBtn.addEventListener("click", toggleCollapsed);
    collapseBtn.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapsed(e);
      }
    });

    const titleEl = headerEl.createSpan({
      text: rowValue,
      cls: "kanbase-swimlane-title",
    });
    if (rowValue === NO_VALUE_SWIMLANE)
      titleEl.addClass("kanbase-no-value-title");

    const rowCount = columns.reduce((sum, columnName) => {
      const entries = entriesByColumn.get(columnName) ?? [];
      const inRow =
        partitionEntriesByRow(this.view, entries, property).get(rowValue) ?? [];
      return sum + inRow.length;
    }, 0);
    headerEl.createSpan({
      text: String(rowCount),
      cls: "kanbase-swimlane-count",
    });

    headerEl.createDiv({ cls: "kanbase-header-spacer" });

    const menuBtn = headerEl.createDiv({ cls: "kanbase-swimlane-menu-btn" });
    setIcon(menuBtn, "more-horizontal");
    menuBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      this.showRowMenu(e, rowValue);
    });

    if (isCollapsed) return;

    const columnsEl = rowEl.createDiv({ cls: "kanbase-swimlane-columns" });
    columns.forEach((columnName, idx) => {
      const group = getGroupForColumn(this.view.currentGroups, columnName);
      const entries = entriesByColumn.get(columnName) ?? [];
      const displayEntries =
        partitionEntriesByRow(this.view, entries, property).get(rowValue) ?? [];
      this.view.columnManager.renderColumn(
        columnsEl,
        columnName,
        group,
        idx,
        this.view.renderer.columnElCache.get(
          this.view.renderer.columnCacheKey(rowValue, columnName),
        ),
        { displayEntries, rowValue, allowDrag: true },
      );
    });
  }

  private showRowMenu(e: MouseEvent, rowValue: string): void {
    const rows = this.lastRenderedRows;
    const idx = rows.indexOf(rowValue);
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("Move row up")
        .setIcon("lucide-arrow-up")
        .setDisabled(idx <= 0)
        .onClick(() => this.moveRow(rowValue, -1)),
    );
    menu.addItem((item) =>
      item
        .setTitle("Move row down")
        .setIcon("lucide-arrow-down")
        .setDisabled(idx === -1 || idx >= rows.length - 1)
        .onClick(() => this.moveRow(rowValue, 1)),
    );
    menu.showAtMouseEvent(e);
  }

  private moveRow(rowValue: string, delta: number): void {
    const rows = [...this.lastRenderedRows];
    const idx = rows.indexOf(rowValue);
    const newIdx = idx + delta;
    if (idx === -1 || newIdx < 0 || newIdx >= rows.length) return;
    [rows[idx], rows[newIdx]] = [rows[newIdx], rows[idx]];
    this.view.preferences.saveSwimlaneRows(rows);
    this.view.updates.scheduleRender();
  }
}
