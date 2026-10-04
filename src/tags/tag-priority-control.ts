import { setIcon, setTooltip } from "obsidian";

export class TagPriorityControl {
  private value: boolean;
  private buttons: Map<boolean, HTMLButtonElement> = new Map();

  constructor(
    container: HTMLElement,
    value: boolean,
    onChange: (selectedFirst: boolean) => void,
  ) {
    this.value = value;
    const group = container.createDiv({
      cls: "kanbase-filter-button-group",
      attr: { role: "group", "aria-label": "Tag selection priority" },
    });
    for (const selectedFirst of [false, true]) {
      const button = group.createEl("button", {
        cls: selectedFirst
          ? "kanbase-filter-selected-first"
          : "kanbase-filter-normal-order",
        attr: { type: "button" },
      });
      setIcon(button, selectedFirst ? "lucide-group" : "lucide-ungroup");
      setTooltip(
        button,
        selectedFirst ? "Show selected tags first" : "Use normal tag order",
      );
      button.addEventListener("click", () => {
        if (this.value === selectedFirst) return;
        this.value = selectedFirst;
        this.updateButtons();
        onChange(selectedFirst);
      });
      this.buttons.set(selectedFirst, button);
    }
    this.updateButtons();
  }

  private updateButtons(): void {
    for (const [selectedFirst, button] of this.buttons) {
      button.setAttr("aria-pressed", String(this.value === selectedFirst));
    }
  }
}
