import { setIcon, setTooltip } from "obsidian";

export class TagVisibilityControl {
  private value: boolean;
  private button: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    value: boolean,
    disabled: boolean,
    onChange: (selectedOnly: boolean) => void,
  ) {
    this.value = value;
    this.button = container.createEl("button", {
      cls: "kanbase-filter-selected-only",
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
    const label = this.value ? "Show all tags" : "Hide unselected tags";
    this.button.setAttr("aria-label", label);
    this.button.setAttr("aria-pressed", String(this.value));
    setIcon(this.button, this.value ? "lucide-eye-off" : "lucide-eye");
    setTooltip(this.button, label);
  }
}
