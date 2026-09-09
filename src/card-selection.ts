import { Menu, Notice } from "obsidian";
import type { KanbanView } from "./kanban-view";

export class CardSelectionManager {
  private view: KanbanView;
  private selectedPaths = new Set<string>();

  constructor(view: KanbanView) {
    this.view = view;
  }

  public hasSelection(): boolean {
    return this.selectedPaths.size > 0;
  }

  public isMultiSelectionContaining(filePath: string): boolean {
    return this.selectedPaths.size > 1 && this.selectedPaths.has(filePath);
  }

  public getSelectedPaths(): ReadonlySet<string> {
    return this.selectedPaths;
  }

  public snapshot(): Set<string> {
    return new Set(this.selectedPaths);
  }

  /** Toggle one card or select a contiguous range within a column. */
  public select(
    filePath: string,
    columnName: string,
    isRangeSelection: boolean,
  ): void {
    if (isRangeSelection && this.selectedPaths.size > 0) {
      this.selectRange(filePath, columnName);
    } else if (this.selectedPaths.has(filePath)) {
      this.selectedPaths.delete(filePath);
    } else {
      this.selectedPaths.add(filePath);
    }

    this.syncCardClasses();
  }

  public clear(): void {
    this.selectedPaths.clear();
    this.view.containerEl
      .querySelectorAll<HTMLElement>(".base-board-card--selected")
      .forEach((element) => element.removeClass("base-board-card--selected"));
  }

  public showMoveMenu(event: MouseEvent): void {
    const selectedPaths = Array.from(this.selectedPaths);
    const groupByProperty = this.view.boardConfig.getGroupByProperty();
    if (!groupByProperty) return;

    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle(`Move ${selectedPaths.length} cards to…`).setDisabled(true);
    });
    menu.addSeparator();

    for (const column of this.view.preferences.getColumns()) {
      menu.addItem((item) => {
        item.setTitle(column).onClick(() => {
          void this.moveToColumn(selectedPaths, column, groupByProperty);
        });
      });
    }

    menu.showAtMouseEvent(event);
  }

  private selectRange(filePath: string, columnName: string): void {
    const columnEl = this.view.containerEl.querySelector(
      `[data-column-name="${CSS.escape(columnName)}"]`,
    );
    if (!columnEl) {
      this.selectedPaths.add(filePath);
      return;
    }

    const paths = Array.from(
      columnEl.querySelectorAll<HTMLElement>(".base-board-card"),
    ).map((element) => element.dataset.filePath ?? "");
    const clickedIndex = paths.indexOf(filePath);
    const lastSelectedIndex = paths.reduceRight((found, path, index) => {
      if (found !== -1) return found;
      return this.selectedPaths.has(path) ? index : -1;
    }, -1);

    if (clickedIndex === -1 || lastSelectedIndex === -1) {
      this.selectedPaths.add(filePath);
      return;
    }

    const from = Math.min(clickedIndex, lastSelectedIndex);
    const to = Math.max(clickedIndex, lastSelectedIndex);
    for (let index = from; index <= to; index++) {
      if (paths[index]) this.selectedPaths.add(paths[index]);
    }
  }

  private syncCardClasses(): void {
    this.view.containerEl
      .querySelectorAll<HTMLElement>(".base-board-card")
      .forEach((element) => {
        element.toggleClass(
          "base-board-card--selected",
          this.selectedPaths.has(element.dataset.filePath ?? ""),
        );
      });
  }

  private async moveToColumn(
    filePaths: string[],
    targetColumn: string,
    groupByProperty: string,
  ): Promise<void> {
    await this.view.cardMoves.movePathsToColumn(
      filePaths,
      targetColumn,
      groupByProperty,
    );

    this.clear();
    new Notice(
      `Moved ${filePaths.length} card${filePaths.length > 1 ? "s" : ""} to "${targetColumn}"`,
    );
  }
}
