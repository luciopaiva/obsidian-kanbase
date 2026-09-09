import {
  BasesView,
  BasesEntry,
  BasesEntryGroup,
  BasesAllOptions,
  BooleanValue,
  HoverParent,
  HoverPopover,
  NumberValue,
  NullValue,
  QueryController,
  setIcon,
  WorkspaceLeaf,
} from "obsidian";
import type BaseBoardPlugin from "./main";
import { DragDropManager } from "./drag-drop";
import { ColumnManager } from "./column";
import { CardManager } from "./card";
import { Tags } from "./tags";
import { BoardToolbar } from "./toolbar";
import { TagFilterBar } from "./tag-filter-bar";
import { CardSelectionManager } from "./card-selection";
import { CardMoveCoordinator } from "./card-move";
import { coerceColumnValue, GroupByValueType } from "./value-utils";
import {
  NO_VALUE_COLUMN,
  CONFIG_KEY_COLUMNS,
  CONFIG_KEY_COLLAPSED_COLUMNS,
  CONFIG_KEY_OPEN_BEHAVIOR,
  CONFIG_KEY_COLUMN_COLORS,
  CONFIG_KEY_WIP_LIMITS,
  CONFIG_KEY_COVER_PROPERTY,
  CONFIG_KEY_ADD_TO_TOP,
} from "./constants";

interface BoardScrollState {
  boardLeft: number;
  viewTop: number;
  columnTops: Map<string, number>;
}

// ---------------------------------------------------------------------------
//  Kanban View
// ---------------------------------------------------------------------------

export class KanbanView extends BasesView implements HoverParent {
  type = "kanban";
  // Required by HoverParent — Obsidian manages the popover lifecycle.
  hoverPopover: HoverPopover | null = null;
  scrollEl: HTMLElement;
  containerEl: HTMLElement;
  plugin: BaseBoardPlugin;

  private dragDropManager: DragDropManager;
  private columnManager: ColumnManager;
  private toolbar: BoardToolbar;
  /** Tag filter state, matching, counts, and filter-bar rendering. */
  public tagFilterBar: TagFilterBar;
  /** Card selection state, range selection, and batch actions. */
  public cardSelection: CardSelectionManager;
  /** Card ordering, cross-column moves, and optimistic render state. */
  public cardMoves: CardMoveCoordinator;
  public currentGroups: BasesEntryGroup[] = [];
  public cardManager: CardManager;

  /** Prevent re-renders while we batch-update frontmatter. */
  private isUpdating = false;
  /** Track if Bases delivered fresh query data while we were updating. */
  private pendingDataRender = false;
  /** True until the first successful render completes. */
  private isFirstRender = true;
  /** Debounce timer for render calls. */
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tag metadata, colors, editing, and Base-filter suppression. */
  public tags: Tags;
  public detailLeaf: WorkspaceLeaf | null = null;

  constructor(
    controller: QueryController,
    scrollEl: HTMLElement,
    plugin: BaseBoardPlugin,
  ) {
    super(controller);
    this.scrollEl = scrollEl;
    this.plugin = plugin;
    this.containerEl = scrollEl.createDiv({ cls: "base-board-container" });

    this.tags = new Tags(this);
    this.toolbar = new BoardToolbar(this);
    this.tagFilterBar = new TagFilterBar(this, this.tags);
    this.cardSelection = new CardSelectionManager(this);
    this.cardMoves = new CardMoveCoordinator(this);
    this.cardManager = new CardManager(this);
    this.columnManager = new ColumnManager(this);

    this.dragDropManager = new DragDropManager(this.app, {
      onCardDrop: (
        filePath: string,
        targetColumn: string,
        orderedPaths: string[],
      ) => this.cardMoves.handleDrop(filePath, targetColumn, orderedPaths),
      onColumnReorder: (orderedNames: string[]) =>
        this.handleColumnReorder(orderedNames),
      getSelectedCards: () => this.cardSelection.getSelectedPaths(),
    });
  }

  onload(): void {}

  onunload(): void {
    this.dragDropManager.destroy();
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
  }

  public focus(): void {
    this.containerEl.focus({ preventScroll: true });
  }

  public onDataUpdated(): void {
    if (this.isUpdating) {
      this.pendingDataRender = true;
      return;
    }
    this.cardMoves.acknowledge();
    this.scheduleRender();
  }

  /**
   * Run a batch of state updates without triggering intermediate re-renders.
   * Defers rendering until the entire batch is complete.
   */
  public async applyBatchUpdate(
    updateFn: () => Promise<void> | void,
  ): Promise<void> {
    this.isUpdating = true;
    this.pendingDataRender = false;

    try {
      await updateFn();
    } finally {
      this.isUpdating = false;
    }

    // If Bases fired onDataUpdated during our batch, schedule a debounced render.
    if (this.pendingDataRender) {
      this.pendingDataRender = false;
      this.scheduleRender();
    }
  }

  static getViewOptions(): BasesAllOptions[] {
    return [
      {
        type: "group" as const,
        displayName: "Display",
        items: [
          {
            key: CONFIG_KEY_OPEN_BEHAVIOR,
            type: "dropdown" as const,
            displayName: "Open card in",
            default: "active",
            options: {
              active: "Active pane / tab",
              modal: "Floating modal",
              split: "Split to the right",
              tab: "New tab",
            },
          },
          {
            key: CONFIG_KEY_COVER_PROPERTY,
            type: "text" as const,
            displayName: "Cover property",
            default: "cover",
            placeholder: "E.g. cover",
          },
          {
            key: CONFIG_KEY_ADD_TO_TOP,
            type: "toggle" as const,
            displayName: "Add new cards to top",
            default: false,
          },
        ],
      },
    ];
  }

  public isAddNewCardsToTop(): boolean {
    return !!this.config?.get(CONFIG_KEY_ADD_TO_TOP);
  }

  // ---------------------------------------------------------------------------
  //  Base identity
  // ---------------------------------------------------------------------------

  /**
   * Build a stable, unique identifier for this board view.
   *
   * Uses the view's display name (unique within a .base file) combined with
   * the groupBy property.  If neither is available we fall back to a hash
   * derived from the file paths currently in the dataset so that column
   * configs never collide across different boards.
   */
  private getBaseId(): string {
    const viewName = this.config?.name ?? "";
    const groupBy = this.getGroupByProperty() ?? "";

    // Try to discover the .base file path from the entries in the dataset.
    // All entries originate from the same .base query so any entry's folder
    // ancestor pattern is a reasonable proxy.  This gives us a path-qualified
    // key even when two .base files share the same view name.
    let basePath = "";
    const entries: BasesEntry[] = this.data?.data ?? [];
    if (entries.length > 0) {
      const firstPath = entries[0].file?.path ?? "";
      const lastSlash = firstPath.lastIndexOf("/");
      basePath = lastSlash > 0 ? firstPath.substring(0, lastSlash) : "";
    }

    return `${basePath}::${viewName}::${groupBy}`;
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  /**
   * Return the frontmatter property name used for groupBy (e.g. "status").
   *
   * The Bases engine stores this in the view config as a BasesPropertyId
   * like "note.status".  We strip the "note." prefix so the result is
   * directly usable as a frontmatter key.
   *
   * Note: `BasesViewConfig.get()` only retrieves custom options registered
   * via `BasesViewRegistration.options`.  The `groupBy` setting is a
   * built-in structural property on the config object, so we access it
   * directly from the config's internal representation.
   */
  public getGroupByProperty(): string | null {
    const cfg = this.config as {
      groupBy?: { property?: string };
      get?: (key: string) => unknown;
    };

    // 1. Direct access to the built-in groupBy config property
    const groupBy = cfg?.groupBy;
    if (groupBy?.property) {
      const raw: string = groupBy.property;
      return raw.startsWith("note.") ? raw.slice(5) : raw;
    }

    // 2. Fallback: try the custom-options API in case future Obsidian
    //    versions surface groupBy through get()
    const fromGet = cfg?.get?.("groupBy") as { property?: string } | undefined;
    if (fromGet?.property) {
      const raw: string = fromGet.property;
      return raw.startsWith("note.") ? raw.slice(5) : raw;
    }

    return null;
  }

  public getCardOpenBehavior(): "active" | "modal" | "split" | "tab" {
    const val = this.config?.get(CONFIG_KEY_OPEN_BEHAVIOR);
    if (val === "modal" || val === "split" || val === "tab") return val;
    return "active";
  }

  public getCardCoverProperty(): string | null {
    const val = this.config?.get(CONFIG_KEY_COVER_PROPERTY);
    if (val === undefined || val === null) {
      return "cover";
    }
    return typeof val === "string" && val.trim() !== "" ? val.trim() : null;
  }

  public isLeafAttached(leaf: WorkspaceLeaf): boolean {
    let found = false;
    this.app.workspace.iterateAllLeaves((l) => {
      if (l === leaf) found = true;
    });
    return found;
  }

  public getColumnColors(): Record<string, string> {
    const raw = this.config?.get(CONFIG_KEY_COLUMN_COLORS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, string>)
      : {};
  }

  public getColumnColor(columnName: string): string | null {
    const customColors = this.getColumnColors();
    return customColors[columnName] ?? null;
  }

  public setColumnColor(columnName: string, color: string): void {
    const colors = this.getColumnColors();
    if (color) {
      colors[columnName] = color;
    } else {
      delete colors[columnName];
    }
    this.config?.set(CONFIG_KEY_COLUMN_COLORS, colors);
    this.scheduleRender();
  }

  // ---------------------------------------------------------------------------
  //  WIP Limits
  // ---------------------------------------------------------------------------

  public getWipLimits(): Record<string, number> {
    const raw = this.config?.get(CONFIG_KEY_WIP_LIMITS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, number>)
      : {};
  }

  public getWipLimit(columnName: string): number | null {
    const limits = this.getWipLimits();
    const val = limits[columnName];
    return typeof val === "number" && val > 0 ? val : null;
  }

  public setWipLimit(columnName: string, limit: number | null): void {
    const limits = this.getWipLimits();
    if (limit !== null && limit > 0) {
      limits[columnName] = limit;
    } else {
      delete limits[columnName];
    }
    this.config?.set(CONFIG_KEY_WIP_LIMITS, limits);
    this.scheduleRender();
  }

  public getColumnName(key: unknown): string {
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

  /**
   * Infer the JS type of the groupBy property from the group keys that Bases
   * actually produced. Bases exposes group keys as typed Value objects, so a
   * checkbox-grouped board yields BooleanValue keys and a numeric one yields
   * NumberValue keys. Booleans win outright so a mix of real checkboxes and
   * already-corrupted "false" strings still resolves to "boolean".
   */
  private groupByValueType(): GroupByValueType {
    for (const group of this.currentGroups) {
      if (group.key instanceof BooleanValue) return "boolean";
      if (group.key instanceof NumberValue) return "number";
    }
    return "other";
  }

  /**
   * Write the groupBy property for a card into `fm`, preserving its real type.
   *
   * The "(No value)" column removes the property entirely; every other column
   * stores a correctly-typed value so a checkbox `false` is never turned into
   * the string "false" (which is truthy and breaks grouping).
   */
  public applyGroupByValue(
    fm: Record<string, unknown>,
    groupByProp: string,
    columnName: string,
  ): void {
    if (columnName === NO_VALUE_COLUMN) {
      delete fm[groupByProp];
      return;
    }
    fm[groupByProp] = coerceColumnValue(columnName, this.groupByValueType());
  }

  // ---------------------------------------------------------------------------
  //  Column config  (dual-layer: .base file via config API + plugin data.json)
  // ---------------------------------------------------------------------------

  /**
   * Read the persisted column order.
   *
   * Priority:
   *  1. View-level config stored inside the .base file (via BasesViewConfig)
   *  2. Legacy plugin data.json (for backwards-compat with existing boards)
   *  3. Fall back to whatever columns the data naturally produces
   *
   * Any columns present in the live data but missing from the stored list
   * are appended at the end so they are never silently hidden.
   */
  public getColumns(): string[] {
    // 1. Try .base file config first (new preferred storage)
    const fromConfig = this.config?.get(CONFIG_KEY_COLUMNS) as
      string[] | undefined;

    // 2. Fallback: legacy plugin data.json
    const fromPlugin = this.plugin.getColumnConfig(this.getBaseId());

    const rawStored = fromConfig?.length
      ? fromConfig
      : fromPlugin?.columns?.length
        ? fromPlugin.columns
        : null;

    const stored = rawStored
      ? rawStored.map((col) => (col === "" ? NO_VALUE_COLUMN : col))
      : null;

    const dataColumns = this.currentGroups.map((g) =>
      this.getColumnName(g.key),
    );

    if (stored && stored.length > 0) {
      const result = [...stored];
      for (const col of dataColumns) {
        if (!result.includes(col)) {
          result.push(col);
        }
      }
      return result;
    }

    return dataColumns;
  }

  public getCollapsedColumns(): Record<string, boolean> {
    const raw = this.config?.get(CONFIG_KEY_COLLAPSED_COLUMNS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, boolean>)
      : {};
  }

  public isColumnCollapsed(columnName: string): boolean {
    return !!this.getCollapsedColumns()[columnName];
  }

  public setColumnCollapsed(columnName: string, collapsed: boolean): void {
    const state = this.getCollapsedColumns();
    if (collapsed) {
      state[columnName] = true;
    } else {
      delete state[columnName];
    }
    this.config?.set(CONFIG_KEY_COLLAPSED_COLUMNS, state);
    this.scheduleRender();
  }

  public toggleColumnCollapsed(columnName: string): void {
    this.setColumnCollapsed(columnName, !this.isColumnCollapsed(columnName));
  }

  private getGroupForColumn(columnName: string): BasesEntryGroup | null {
    for (const group of this.currentGroups) {
      if (this.getColumnName(group.key) === columnName) {
        return group;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  //  Rendering
  // ---------------------------------------------------------------------------

  /**
   * Ensure `file.name` is present in the view's property `order:` configuration.
   * This guarantees that Obsidian's database engine indexes card titles for search.
   */
  private ensureFileNameInOrder(): void {
    if (!this.config) return;
    const currentOrder =
      (this.config.get("order") as string[] | undefined) ?? [];
    if (
      !currentOrder.includes("file.name") &&
      !currentOrder.includes("file.file")
    ) {
      this.config.set("order", ["file.name", ...currentOrder]);
    }
  }

  public cardElCache = new Map<string, HTMLElement>();
  public columnElCache = new Map<string, HTMLElement>();

  public render(): void {
    this.ensureFileNameInOrder();
    this.cardSelection.clear();
    const scrollState = this.captureScrollState();

    // Index stable DOM nodes before rebuilding the lightweight board shell.
    // Columns are detached as complete subtrees, preserving their card lists,
    // card descendants, scroll state, image elements, and event listeners.
    this.cardElCache.clear();
    this.containerEl.querySelectorAll(".base-board-card").forEach((el) => {
      const path = (el as HTMLElement).dataset.filePath;
      if (path) {
        this.cardElCache.set(path, el as HTMLElement);
      }
    });

    this.columnElCache.clear();
    this.containerEl
      .querySelectorAll<HTMLElement>(".base-board-column")
      .forEach((el) => {
        const name = el.dataset.columnName;
        if (name) {
          this.columnElCache.set(name, el);
          el.remove();
        }
      });

    this.containerEl.empty();

    // Use the official API: this.data is a BasesQueryResult
    const groupedData: BasesEntryGroup[] = this.data?.groupedData ?? [];
    const hasGroupBy =
      groupedData.length > 1 ||
      (groupedData.length === 1 &&
        groupedData[0].key !== undefined &&
        !(groupedData[0].key instanceof NullValue));

    // If the board has configured columns (from .base or data.json) but
    // no cards exist yet, render the empty columns so users can see and
    // add cards instead of showing an opaque placeholder.
    const stored =
      (this.config?.get(CONFIG_KEY_COLUMNS) as string[] | undefined) ??
      this.plugin.getColumnConfig(this.getBaseId())?.columns;
    const hasStoredColumns = stored && stored.length > 0;
    const shouldShowPlaceholder =
      !hasGroupBy && groupedData.length <= 1 && !hasStoredColumns;

    if (shouldShowPlaceholder) {
      const msgEl = this.containerEl.createDiv({
        cls: "base-board-placeholder",
      });
      setIcon(
        msgEl.createSpan({ cls: "base-board-placeholder-icon" }),
        "lucide-kanban",
      );
      msgEl.createEl("p", {
        text: 'Set "group by" in the sort menu to organize cards into columns.',
      });
      return;
    }

    this.currentGroups = groupedData;
    this.tags.refreshBaseFilterTags();
    this.tagFilterBar.refresh();
    const columns = this.getColumns();
    const boardEl = this.containerEl.createDiv({ cls: "base-board-board" });

    // Only animate cards on the very first render
    if (this.isFirstRender) {
      boardEl.addClass("base-board-board--animate");
      this.isFirstRender = false;
    }

    this.toolbar.render(this.containerEl);
    this.tagFilterBar.render(
      this.containerEl,
      this.toolbar.areTagFiltersVisible(),
    );

    columns.forEach((columnName, idx) => {
      const group = this.getGroupForColumn(columnName);
      this.columnManager.renderColumn(
        boardEl,
        columnName,
        group,
        idx,
        this.columnElCache.get(columnName),
      );
    });

    this.columnManager.renderAddColumnButton(boardEl);
    this.dragDropManager.initBoard(boardEl);
    this.restoreScrollState(boardEl, scrollState);
  }

  private captureScrollState(): BoardScrollState {
    const boardEl =
      this.containerEl.querySelector<HTMLElement>(".base-board-board");
    const columnTops = new Map<string, number>();

    boardEl
      ?.querySelectorAll<HTMLElement>(".base-board-column")
      .forEach((columnEl) => {
        const name = columnEl.dataset.columnName;
        const cardsEl =
          columnEl.querySelector<HTMLElement>(".base-board-cards");
        if (name && cardsEl) columnTops.set(name, cardsEl.scrollTop);
      });

    return {
      boardLeft: boardEl?.scrollLeft ?? 0,
      viewTop: this.scrollEl.scrollTop,
      columnTops,
    };
  }

  private restoreScrollState(
    boardEl: HTMLElement,
    state: BoardScrollState,
  ): void {
    // All columns are attached, so these assignments restore against the final
    // layout and cannot race a deferred callback from an earlier render.
    boardEl.scrollLeft = state.boardLeft;
    this.scrollEl.scrollTop = state.viewTop;

    boardEl
      .querySelectorAll<HTMLElement>(".base-board-column")
      .forEach((columnEl) => {
        const name = columnEl.dataset.columnName;
        const cardsEl =
          columnEl.querySelector<HTMLElement>(".base-board-cards");
        const scrollTop = name ? state.columnTops.get(name) : undefined;
        if (cardsEl && scrollTop !== undefined) {
          cardsEl.scrollTop = scrollTop;
        }
      });
  }

  // ---------------------------------------------------------------------------
  //  Column & Filter management helpers
  // ---------------------------------------------------------------------------

  private handleColumnReorder(orderedNames: string[]): void {
    this.saveColumns(orderedNames);
    this.render();
  }

  /**
   * Persist the column list.
   *
   * Writes to two locations for compatibility:
   *  - BasesViewConfig (stored inside the .base file itself — portable)
   *  - Plugin data.json (legacy, kept so older board setups still work)
   */
  public saveColumns(columns: string[]): void {
    // Primary: persist in .base file via the official config API
    const toSave = columns.map((col) => (col === NO_VALUE_COLUMN ? "" : col));
    this.config?.set(CONFIG_KEY_COLUMNS, toSave);

    // Legacy fallback: also write to plugin data.json
    void this.plugin.saveColumnConfig(this.getBaseId(), { columns });
  }

  public updateColumnPreferences(oldName: string, newName: string): void {
    const collapsed = this.getCollapsedColumns();
    if (collapsed[oldName]) {
      delete collapsed[oldName];
      collapsed[newName] = true;
      this.config?.set(CONFIG_KEY_COLLAPSED_COLUMNS, collapsed);
    }
  }

  public removeColumnPreferences(columnName: string): void {
    const collapsed = this.getCollapsedColumns();
    if (collapsed[columnName]) {
      delete collapsed[columnName];
      this.config?.set(CONFIG_KEY_COLLAPSED_COLUMNS, collapsed);
    }
  }

  /** Debounced render — coalesces multiple calls into one. */
  public scheduleRender(): void {
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 50);
  }
}
