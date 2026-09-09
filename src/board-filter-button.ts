import { setIcon, setTooltip } from "obsidian";
import type { KanbanView } from "./kanban-view";

export class BoardFilterButton {
  constructor(private readonly view: KanbanView) {}

  public render(container: HTMLElement): void {
    const tagFiltersVisible = this.view.preferences.areTagFiltersVisible();
    const button = container.createEl("button", {
      cls: "clickable-icon base-board-toolbar-button",
      attr: {
        type: "button",
        "aria-label": tagFiltersVisible
          ? "Hide tag filters"
          : "Show tag filters",
        "aria-pressed": String(tagFiltersVisible),
      },
    });
    setIcon(button, "lucide-filter");
    button.toggleClass("is-active", tagFiltersVisible);
    setTooltip(
      button,
      tagFiltersVisible ? "Hide tag filters" : "Show tag filters",
    );

    button.addEventListener("click", () => {
      this.view.preferences.setTagFiltersVisible(!tagFiltersVisible);
    });
  }
}
