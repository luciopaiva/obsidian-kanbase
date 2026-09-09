import {
  CONFIG_KEY_COLLAPSED_COLUMNS,
  CONFIG_KEY_COLUMN_COLORS,
  CONFIG_KEY_COLUMNS,
  CONFIG_KEY_TAG_FILTERS_VISIBLE,
  CONFIG_KEY_WIP_LIMITS,
  NO_VALUE_COLUMN,
} from "./constants";
import type { KanbanView } from "./kanban-view";

export class BoardPreferences {
  private view: KanbanView;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public hasStoredColumns(): boolean {
    const configured = this.view.config?.get(CONFIG_KEY_COLUMNS) as
      string[] | undefined;
    const legacy = this.view.plugin.getColumnConfig(this.getBoardId())?.columns;
    const stored = configured ?? legacy;
    return !!stored?.length;
  }

  public getColumns(): string[] {
    const configured = this.view.config?.get(CONFIG_KEY_COLUMNS) as
      string[] | undefined;
    const legacy = this.view.plugin.getColumnConfig(this.getBoardId());
    const stored = configured?.length
      ? configured
      : legacy?.columns?.length
        ? legacy.columns
        : null;
    const storedColumns = stored
      ? stored.map((column) => (column === "" ? NO_VALUE_COLUMN : column))
      : null;
    const dataColumns = this.view.currentGroups.map((group) =>
      this.view.getColumnName(group.key),
    );

    if (!storedColumns?.length) return dataColumns;

    const columns = [...storedColumns];
    for (const column of dataColumns) {
      if (!columns.includes(column)) columns.push(column);
    }
    return columns;
  }

  public saveColumns(columns: string[]): void {
    const serialized = columns.map((column) =>
      column === NO_VALUE_COLUMN ? "" : column,
    );
    this.view.config?.set(CONFIG_KEY_COLUMNS, serialized);
    void this.view.plugin.saveColumnConfig(this.getBoardId(), { columns });
  }

  public getColumnColor(columnName: string): string | null {
    return this.getColumnColors()[columnName] ?? null;
  }

  public setColumnColor(columnName: string, color: string): void {
    const colors = this.getColumnColors();
    if (color) {
      colors[columnName] = color;
    } else {
      delete colors[columnName];
    }
    this.view.config?.set(CONFIG_KEY_COLUMN_COLORS, colors);
    this.view.scheduleRender();
  }

  public getWipLimit(columnName: string): number | null {
    const limit = this.getWipLimits()[columnName];
    return typeof limit === "number" && limit > 0 ? limit : null;
  }

  public setWipLimit(columnName: string, limit: number | null): void {
    const limits = this.getWipLimits();
    if (limit !== null && limit > 0) {
      limits[columnName] = limit;
    } else {
      delete limits[columnName];
    }
    this.view.config?.set(CONFIG_KEY_WIP_LIMITS, limits);
    this.view.scheduleRender();
  }

  public areTagFiltersVisible(): boolean {
    return this.view.config?.get(CONFIG_KEY_TAG_FILTERS_VISIBLE) !== false;
  }

  public setTagFiltersVisible(visible: boolean): void {
    this.view.config?.set(CONFIG_KEY_TAG_FILTERS_VISIBLE, visible);
    this.view.scheduleRender();
  }

  public isColumnCollapsed(columnName: string): boolean {
    return !!this.getCollapsedColumns()[columnName];
  }

  public toggleColumnCollapsed(columnName: string): void {
    const collapsed = this.getCollapsedColumns();
    if (collapsed[columnName]) {
      delete collapsed[columnName];
    } else {
      collapsed[columnName] = true;
    }
    this.view.config?.set(CONFIG_KEY_COLLAPSED_COLUMNS, collapsed);
    this.view.scheduleRender();
  }

  public renameColumnState(oldName: string, newName: string): void {
    const collapsed = this.getCollapsedColumns();
    if (!collapsed[oldName]) return;
    delete collapsed[oldName];
    collapsed[newName] = true;
    this.view.config?.set(CONFIG_KEY_COLLAPSED_COLUMNS, collapsed);
  }

  public removeColumnState(columnName: string): void {
    const collapsed = this.getCollapsedColumns();
    if (!collapsed[columnName]) return;
    delete collapsed[columnName];
    this.view.config?.set(CONFIG_KEY_COLLAPSED_COLUMNS, collapsed);
  }

  private getColumnColors(): Record<string, string> {
    const raw = this.view.config?.get(CONFIG_KEY_COLUMN_COLORS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, string>)
      : {};
  }

  private getWipLimits(): Record<string, number> {
    const raw = this.view.config?.get(CONFIG_KEY_WIP_LIMITS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, number>)
      : {};
  }

  private getCollapsedColumns(): Record<string, boolean> {
    const raw = this.view.config?.get(CONFIG_KEY_COLLAPSED_COLUMNS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, boolean>)
      : {};
  }

  /** Build the legacy plugin-data key used by existing board installations. */
  private getBoardId(): string {
    const viewName = this.view.config?.name ?? "";
    const groupBy = this.view.getGroupByProperty() ?? "";
    let basePath = "";
    const firstPath = this.view.data?.data?.[0]?.file?.path ?? "";
    const lastSlash = firstPath.lastIndexOf("/");
    if (lastSlash > 0) basePath = firstPath.substring(0, lastSlash);
    return `${basePath}::${viewName}::${groupBy}`;
  }
}
