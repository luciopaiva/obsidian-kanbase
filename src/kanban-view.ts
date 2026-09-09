import {
  BasesView,
  BasesEntryGroup,
  HoverParent,
  HoverPopover,
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
import { BoardPreferences } from "./board-preferences";
import { CardCreationManager } from "./card-creation";
import { getColumnName, getGroupForColumn } from "./board-grouping";
import { getBaseFileName, isLeafAttached } from "./base-view-context";
import { BoardConfig } from "./board-config";

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
  /** Board display preferences and their persistence. */
  public preferences: BoardPreferences;
  /** Inline card creation, defaults, and initial ordering. */
  public cardCreation: CardCreationManager;
  public currentGroups: BasesEntryGroup[] = [];
  public boardConfig: BoardConfig;
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
    this.boardConfig = new BoardConfig(
      this.config,
      () => this.currentGroups,
      () => this.scheduleRender(),
    );

    this.tags = new Tags(this);
    this.toolbar = new BoardToolbar(this);
    this.tagFilterBar = new TagFilterBar(this, this.tags);
    this.cardSelection = new CardSelectionManager(this);
    this.cardMoves = new CardMoveCoordinator(this);
    this.preferences = new BoardPreferences(this);
    this.cardCreation = new CardCreationManager(this);
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

  public isLeafAttached(leaf: WorkspaceLeaf): boolean {
    return isLeafAttached(this.app, leaf);
  }

  /** Base file name (without extension) when this view is opened directly. */
  public getBaseFileName(): string | null {
    return getBaseFileName(this.app, this.scrollEl);
  }

  public getColumnName(key: unknown): string {
    return getColumnName(key);
  }

  // ---------------------------------------------------------------------------
  //  Rendering
  // ---------------------------------------------------------------------------

  /**
   * Ensure `file.name` is present in the view's property `order:` configuration.
   * This guarantees that Obsidian's database engine indexes card titles for search.
   */
  public cardElCache = new Map<string, HTMLElement>();
  public columnElCache = new Map<string, HTMLElement>();

  public render(): void {
    this.boardConfig.ensureFileNameInOrder();
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
    const hasStoredColumns = this.preferences.hasStoredColumns();
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
    const columns = this.preferences.getColumns();
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
      const group = getGroupForColumn(this.currentGroups, columnName);
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
    this.preferences.saveColumns(orderedNames);
    this.render();
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
