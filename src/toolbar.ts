import { setIcon, setTooltip } from "obsidian";
import type { KanbanView } from "./kanban-view";

export class BoardToolbar {
  private view: KanbanView;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public areTagFiltersVisible(): boolean {
    return this.view.preferences.areTagFiltersVisible();
  }

  public render(container: HTMLElement): void {
    const boardEl = container.querySelector(".base-board-board");
    if (!boardEl) return;

    const toolbarEl = container.createDiv({ cls: "base-board-toolbar" });
    container.insertBefore(toolbarEl, boardEl);
    const tagFiltersVisible = this.areTagFiltersVisible();

    const filterButton = toolbarEl.createEl("button", {
      cls: "clickable-icon base-board-toolbar-button",
      attr: {
        type: "button",
        "aria-label": tagFiltersVisible
          ? "Hide tag filters"
          : "Show tag filters",
        "aria-pressed": String(tagFiltersVisible),
      },
    });
    setIcon(filterButton, "lucide-filter");
    filterButton.toggleClass("is-active", tagFiltersVisible);
    setTooltip(
      filterButton,
      tagFiltersVisible ? "Hide tag filters" : "Show tag filters",
    );

    filterButton.addEventListener("click", () => {
      this.view.preferences.setTagFiltersVisible(!tagFiltersVisible);
    });
  }
}
