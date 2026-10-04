import { setIcon, setTooltip } from "obsidian";

export type TagSortOrder = "alphabetical" | "count";

/** Tag ordering buttons; persistence and tag rendering belong to the caller. */
export class TagSortControl {
  private value: TagSortOrder;
  private buttons: Map<TagSortOrder, HTMLButtonElement> = new Map();

  constructor(
    container: HTMLElement,
    value: TagSortOrder,
    onChange: (order: TagSortOrder) => void,
  ) {
    this.value = value;
    const group = container.createDiv({
      cls: "kanbase-filter-button-group",
      attr: { role: "group", "aria-label": "Tag sort order" },
    });
    for (const order of ["alphabetical", "count"] as const) {
      const button = group.createEl("button", {
        cls: "kanbase-filter-sort",
        attr: { type: "button", "data-sort-order": order },
      });
      setIcon(
        button,
        order === "alphabetical"
          ? "lucide-arrow-down-az"
          : "lucide-arrow-down-wide-narrow",
      );
      setTooltip(
        button,
        order === "alphabetical"
          ? "Sort alphabetically"
          : "Sort by count, highest first",
      );
      button.addEventListener("click", () => {
        if (this.value === order) return;
        this.value = order;
        this.updateButtons();
        onChange(order);
      });
      this.buttons.set(order, button);
    }
    this.updateButtons();
  }

  private updateButtons(): void {
    for (const [order, button] of this.buttons) {
      button.setAttr("aria-pressed", String(this.value === order));
    }
  }
}
