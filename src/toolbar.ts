import { setIcon, setTooltip } from "obsidian";
import type { KanbanView } from "./kanban-view";

export class BoardToolbar {
  private view: KanbanView;
  private tagFiltersVisible = true;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public areTagFiltersVisible(): boolean {
    return this.tagFiltersVisible;
  }

  public render(container: HTMLElement): void {
    const boardEl = container.querySelector(".base-board-board");
    if (!boardEl) return;

    const toolbarEl = container.createDiv({ cls: "base-board-toolbar" });
    container.insertBefore(toolbarEl, boardEl);

    const filterButton = toolbarEl.createEl("button", {
      cls: "clickable-icon base-board-toolbar-button",
      attr: {
        type: "button",
        "aria-label": this.tagFiltersVisible
          ? "Hide tag filters"
          : "Show tag filters",
        "aria-pressed": String(this.tagFiltersVisible),
      },
    });
    setIcon(filterButton, "lucide-filter");
    filterButton.toggleClass("is-active", this.tagFiltersVisible);
    setTooltip(
      filterButton,
      this.tagFiltersVisible ? "Hide tag filters" : "Show tag filters",
    );

    filterButton.addEventListener("click", () => {
      this.tagFiltersVisible = !this.tagFiltersVisible;
      this.view.scheduleRender();
    });
  }
}
