import {
  BasesView,
  BasesEntryGroup,
  BasesAllOptions,
  HoverParent,
  HoverPopover,
  QueryController,
} from "obsidian";
import type BaseBoardPlugin from "./main";
import { DragDropManager } from "./board/drag-drop";
import { ColumnManager } from "./board/column";
import { CardManager } from "./cards/card";
import { Tags } from "./tags/tags";
import { BoardToolbar } from "./board/toolbar";
import { TagFilterBar } from "./tags/tag-filter-bar";
import { CardSelectionManager } from "./cards/card-selection";
import { CardMoveCoordinator } from "./cards/card-move";
import { BoardPreferences } from "./board/board-preferences";
import { CardCreationManager } from "./cards/card-creation";
import { getColumnName } from "./board/board-grouping";
import { getBaseFileName } from "./board/base-view-context";
import { BoardConfig } from "./board/board-config";
import { BoardRenderer } from "./board/board-renderer";
import { BoardUpdateCoordinator } from "./board/board-update-coordinator";
import { CardNavigation } from "./cards/card-navigation";

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
  public updates: BoardUpdateCoordinator;
  public navigation: CardNavigation;
  public cardManager: CardManager;

  /** Tag metadata, colors, editing, and Base-filter suppression. */
  public tags: Tags;

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
      // Obsidian replaces the config object after updates, so resolve it lazily.
      () => this.config,
      () => this.currentGroups,
      () => this.updates.scheduleRender(),
    );
    this.renderer = new BoardRenderer(this);
    this.navigation = new CardNavigation(this);

    this.tags = new Tags(this);
    this.toolbar = new BoardToolbar(this);
    this.tagFilterBar = new TagFilterBar(this, this.tags);
    this.cardSelection = new CardSelectionManager(this);
    this.cardMoves = new CardMoveCoordinator(this);
    this.updates = new BoardUpdateCoordinator(
      () => this.cardMoves.acknowledge(),
      () => this.render(),
    );
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

  /**
   * Keep these keys registered so BasesViewConfig.get/set can access them,
   * while hiding the controls from Obsidian's built-in configure menu. The
   * controls are exposed through BoardMoreMenu instead.
   */
  static getViewOptions(): BasesAllOptions[] {
    return [
      {
        type: "group" as const,
        displayName: "Display",
        shouldHide: () => true,
        items: [
          {
            key: "cardOpenBehavior",
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
            key: "cardCoverProperty",
            type: "text" as const,
            displayName: "Cover property",
            default: "cover",
            placeholder: "E.g. cover",
          },
          {
            key: "newCardsToTop",
            type: "toggle" as const,
            displayName: "Add new cards to top",
            default: false,
          },
        ],
      },
    ];
  }

  onload(): void {}

  onunload(): void {
    this.dragDropManager.destroy();
    this.updates.destroy();
  }

  public focus(): void {
    this.containerEl.focus({ preventScroll: true });
  }

  public onDataUpdated(): void {
    this.updates.onDataUpdated();
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
}
