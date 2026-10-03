import { setIcon, setTooltip } from "obsidian";

export class TagPriorityControl {
  private value: boolean;
  private button: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    value: boolean,
    disabled: boolean,
    onChange: (selectedFirst: boolean) => void,
  ) {
    this.value = value;
    this.button = container.createEl("button", {
      cls: "kanbase-filter-selected-first",
      attr: { type: "button" },
    });
    this.button.disabled = disabled;
    this.button.addEventListener("click", () => {
      if (this.button.disabled) return;
      this.value = !this.value;
      this.updateButton();
      onChange(this.value);
    });
    this.updateButton();
  }

  private updateButton(): void {
    const label = this.value
      ? "Use normal tag order"
      : "Show selected tags first";
    this.button.setAttr("aria-label", label);
    this.button.setAttr("aria-pressed", String(this.value));
    setIcon(this.button, "lucide-list-filter");
    setTooltip(this.button, label);
  }
}
