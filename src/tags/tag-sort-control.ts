import { setIcon, setTooltip } from "obsidian";

export type TagSortOrder = "alphabetical" | "count";

/** Tag ordering buttons; persistence and tag rendering belong to the caller. */
export class TagSortControl {
  private value: TagSortOrder;
  private button: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    value: TagSortOrder,
    onChange: (order: TagSortOrder) => void,
  ) {
    this.value = value;
    this.button = container.createEl("button", {
      cls: "kanbase-filter-sort",
      attr: {
        type: "button",
      },
    });

    this.button.addEventListener("click", () => {
      this.value = this.value === "alphabetical" ? "count" : "alphabetical";
      this.updateButton();
      onChange(this.value);
    });
    this.updateButton();
  }

  private updateButton(): void {
    const byCount = this.value === "count";
    this.button.setAttr("aria-pressed", String(byCount));
    setIcon(
      this.button,
      byCount ? "lucide-arrow-down-wide-narrow" : "lucide-arrow-down-az",
    );
    setTooltip(
      this.button,
      byCount ? "Sort alphabetically" : "Sort by count, highest first",
    );
  }
}
