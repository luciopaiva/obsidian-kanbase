import {
  BasesView,
  BasesEntryGroup,
  HoverParent,
  HoverPopover,
  QueryController,
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
import { getColumnName } from "./board-grouping";
import { getBaseFileName, isLeafAttached } from "./base-view-context";
import { BoardConfig } from "./board-config";
import { BoardRenderer } from "./board-renderer";

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

  public dragDropManager: DragDropManager;
  public columnManager: ColumnManager;
  public toolbar: BoardToolbar;
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
  public renderer: BoardRenderer;
  public cardManager: CardManager;

  /** Prevent re-renders while we batch-update frontmatter. */
  private isUpdating = false;
  /** Track if Bases delivered fresh query data while we were updating. */
  private pendingDataRender = false;
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
    this.renderer = new BoardRenderer(this);

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

  public render(): void {
    this.renderer.render();
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
