import { setIcon, setTooltip } from "obsidian";
import type { KanbanView } from "../kanban-view";

export class BoardFilterButton {
  constructor(private readonly view: KanbanView) {}

  public render(container: HTMLElement): void {
    const tagFiltersVisible = this.view.preferences.areTagFiltersVisible();
    const button = container.createEl("button", {
      cls: "clickable-icon kanbase-filter-toggle",
      attr: {
        type: "button",
        "aria-label": tagFiltersVisible
          ? "Hide tag filters"
          : "Show tag filters",
        "aria-expanded": String(tagFiltersVisible),
      },
    });
    const icon = button.createSpan({ cls: "kanbase-filter-toggle-icon" });
    icon.setAttr("aria-hidden", "true");
    setIcon(
      icon,
      tagFiltersVisible ? "lucide-chevron-down" : "lucide-chevron-right",
    );
    button.createSpan({
      cls: "kanbase-filter-toggle-label",
      text: "Tag filters",
    });
    setTooltip(
      button,
      tagFiltersVisible ? "Hide tag filters" : "Show tag filters",
    );

    button.addEventListener("click", () => {
      this.view.preferences.setTagFiltersVisible(!tagFiltersVisible);
    });
  }
}
