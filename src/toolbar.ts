import type { KanbanView } from "./kanban-view";
import { BoardFilterButton } from "./board-filter-button";
import { BoardMoreMenu } from "./board-more-menu";

export class BoardToolbar {
  private view: KanbanView;
  private filterButton: BoardFilterButton;
  private moreMenu: BoardMoreMenu;

  constructor(view: KanbanView) {
    this.view = view;
    this.filterButton = new BoardFilterButton(view);
    this.moreMenu = new BoardMoreMenu(view);
  }

  public areTagFiltersVisible(): boolean {
    return this.view.preferences.areTagFiltersVisible();
  }

  public render(container: HTMLElement): void {
    const boardEl = container.querySelector(".base-board-board");
    if (!boardEl) return;

    const toolbarEl = container.createDiv({ cls: "base-board-toolbar" });
    container.insertBefore(toolbarEl, boardEl);

    const baseName = this.view.getBaseFileName();
    toolbarEl.createDiv({
      cls: "base-board-toolbar-title",
      text: baseName ? `${baseName} kanban` : "Kanban",
    });

    this.filterButton.render(toolbarEl);

    this.moreMenu.render(toolbarEl);
  }
}
