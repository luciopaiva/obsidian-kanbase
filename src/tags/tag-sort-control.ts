import { setTooltip } from "obsidian";

export type TagSortOrder = "alphabetical" | "count";

/** Tag ordering buttons; persistence and tag rendering belong to the caller. */
export class TagSortControl {
  private value: TagSortOrder;
  private buttons = new Map<TagSortOrder, HTMLButtonElement>();

  constructor(
    container: HTMLElement,
    value: TagSortOrder,
    onChange: (order: TagSortOrder) => void,
  ) {
    this.value = value;
    const group = container.createDiv({
      cls: "kanbase-filter-sort",
      attr: { role: "group", "aria-label": "Tag sort order" },
    });

    for (const option of [
      {
        value: "alphabetical",
        label: "A–Z",
        tooltip: "Sort alphabetically",
      },
      {
        value: "count",
        label: "Count ↓",
        tooltip: "Sort by count, highest first",
      },
    ] as const) {
      const button = group.createEl("button", {
        text: option.label,
        attr: {
          type: "button",
          "aria-label": option.tooltip,
          "aria-pressed": String(this.value === option.value),
        },
      });
      setTooltip(button, option.tooltip);
      this.buttons.set(option.value, button);
      button.addEventListener("click", () => {
        if (this.value === option.value) return;
        this.value = option.value;
        for (const [order, sortButton] of this.buttons) {
          sortButton.setAttr("aria-pressed", String(this.value === order));
        }
        onChange(this.value);
      });
    }
  }
}
