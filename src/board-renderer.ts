import { BasesEntryGroup, NullValue, setIcon } from "obsidian";
import type { KanbanView } from "./kanban-view";
import { getGroupForColumn } from "./board-grouping";

interface BoardScrollState {
  boardLeft: number;
  viewTop: number;
  columnTops: Map<string, number>;
}

export class BoardRenderer {
  public readonly cardElCache = new Map<string, HTMLElement>();
  public readonly columnElCache = new Map<string, HTMLElement>();
  private isFirstRender = true;

  constructor(private readonly view: KanbanView) {}

  public render(): void {
    this.view.boardConfig.ensureFileNameInOrder();
    this.view.cardSelection.clear();
    const scrollState = this.captureScrollState();

    this.cardElCache.clear();
    this.view.containerEl.querySelectorAll(".base-board-card").forEach((el) => {
      const path = (el as HTMLElement).dataset.filePath;
      if (path) this.cardElCache.set(path, el as HTMLElement);
    });

    this.columnElCache.clear();
    this.view.containerEl
      .querySelectorAll<HTMLElement>(".base-board-column")
      .forEach((el) => {
        const name = el.dataset.columnName;
        if (name) {
          this.columnElCache.set(name, el);
          el.remove();
        }
      });

    this.view.containerEl.empty();

    const groupedData: BasesEntryGroup[] = this.view.data?.groupedData ?? [];
    const hasGroupBy =
      groupedData.length > 1 ||
      (groupedData.length === 1 &&
        groupedData[0].key !== undefined &&
        !(groupedData[0].key instanceof NullValue));
    const hasStoredColumns = this.view.preferences.hasStoredColumns();
    const shouldShowPlaceholder =
      !hasGroupBy && groupedData.length <= 1 && !hasStoredColumns;

    if (shouldShowPlaceholder) {
      const msgEl = this.view.containerEl.createDiv({
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

    this.view.currentGroups = groupedData;
    this.view.tags.refreshBaseFilterTags();
    this.view.tagFilterBar.refresh();
    const columns = this.view.preferences.getColumns();
    const boardEl = this.view.containerEl.createDiv({
      cls: "base-board-board",
    });

    if (this.isFirstRender) {
      boardEl.addClass("base-board-board--animate");
      this.isFirstRender = false;
    }

    this.view.toolbar.render(this.view.containerEl);
    this.view.tagFilterBar.render(
      this.view.containerEl,
      this.view.toolbar.areTagFiltersVisible(),
    );

    columns.forEach((columnName, idx) => {
      const group = getGroupForColumn(this.view.currentGroups, columnName);
      this.view.columnManager.renderColumn(
        boardEl,
        columnName,
        group,
        idx,
        this.columnElCache.get(columnName),
      );
    });

    this.view.columnManager.renderAddColumnButton(boardEl);
    this.view.dragDropManager.initBoard(boardEl);
    this.restoreScrollState(boardEl, scrollState);
  }

  private captureScrollState(): BoardScrollState {
    const boardEl =
      this.view.containerEl.querySelector<HTMLElement>(".base-board-board");
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
      viewTop: this.view.scrollEl.scrollTop,
      columnTops,
    };
  }

  private restoreScrollState(
    boardEl: HTMLElement,
    state: BoardScrollState,
  ): void {
    boardEl.scrollLeft = state.boardLeft;
    this.view.scrollEl.scrollTop = state.viewTop;
    boardEl
      .querySelectorAll<HTMLElement>(".base-board-column")
      .forEach((columnEl) => {
        const name = columnEl.dataset.columnName;
        const cardsEl =
          columnEl.querySelector<HTMLElement>(".base-board-cards");
        const scrollTop = name ? state.columnTops.get(name) : undefined;
        if (cardsEl && scrollTop !== undefined) cardsEl.scrollTop = scrollTop;
      });
  }
}
