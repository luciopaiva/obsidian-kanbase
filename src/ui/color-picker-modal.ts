import { App, Modal, Setting } from "obsidian";

export class ColorPickerModal extends Modal {
  private tag: string;
  private currentColor: string;
  private onChange: (color: string) => void;

  constructor(
    app: App,
    tag: string,
    currentColor: string,
    onChange: (color: string) => void,
  ) {
    super(app);
    this.tag = tag;
    this.currentColor = currentColor;
    this.onChange = onChange;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Color for "${this.tag}"` });

    new Setting(contentEl).setName("Tag color").addColorPicker((color) => {
      color.setValue(this.currentColor);
      color.onChange((value) => {
        this.currentColor = value;
        this.onChange(value);
      });
    });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText("Reset to default").onClick(() => {
          this.onChange("");
          this.close();
        });
        btn.buttonEl.classList.add("mod-warning");
      })
      .addButton((btn) => {
        btn
          .setButtonText("Done")
          .setCta()
          .onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
