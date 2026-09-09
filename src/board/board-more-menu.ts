import { Menu, Modal, Setting, setIcon, setTooltip } from "obsidian";
import type { KanbanView } from "../kanban-view";

export class BoardMoreMenu {
  constructor(private readonly view: KanbanView) {}

  public render(container: HTMLElement): void {
    const button = container.createEl("button", {
      cls: "clickable-icon base-board-toolbar-button",
      attr: {
        type: "button",
        "aria-label": "Configure board",
      },
    });
    setIcon(button, "more-vertical");
    setTooltip(button, "Configure board");
    button.addEventListener("click", (event) => {
      this.showConfigurationMenu(event);
    });
  }

  private showConfigurationMenu(event: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => item.setIsLabel(true).setTitle("Display"));

    const openBehavior = this.view.boardConfig.getCardOpenBehavior();
    const openOptions: Array<{
      value: "active" | "modal" | "split" | "tab";
      label: string;
    }> = [
      { value: "active", label: "Open cards in active pane / tab" },
      { value: "modal", label: "Open cards in floating modal" },
      { value: "split", label: "Open cards split to the right" },
      { value: "tab", label: "Open cards in new tab" },
    ];
    for (const option of openOptions) {
      menu.addItem((item) =>
        item
          .setTitle(option.label)
          .setChecked(openBehavior === option.value)
          .onClick(() =>
            this.view.boardConfig.setCardOpenBehavior(option.value),
          ),
      );
    }

    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Set cover property…").onClick(() => {
        new CoverPropertyModal(
          this.view,
          this.view.boardConfig.getCardCoverProperty() ?? "",
        ).open();
      }),
    );
    menu.addItem((item) =>
      item
        .setTitle("Add new cards to top")
        .setChecked(this.view.boardConfig.shouldAddNewCardsToTop())
        .onClick(() =>
          this.view.boardConfig.setAddNewCardsToTop(
            !this.view.boardConfig.shouldAddNewCardsToTop(),
          ),
        ),
    );

    menu.showAtMouseEvent(event);
  }
}

class CoverPropertyModal extends Modal {
  private property: string;

  constructor(
    private readonly view: KanbanView,
    property: string,
  ) {
    super(view.app);
    this.property = property;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Cover property" });

    new Setting(this.contentEl)
      .setName("Property")
      .setDesc("The file property used for card cover images.")
      .addText((text) =>
        text
          .setPlaceholder("E.g. Cover")
          .setValue(this.property)
          .onChange((value) => {
            this.property = value;
          }),
      );

    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            this.view.boardConfig.setCardCoverProperty(this.property.trim());
            this.close();
          }),
      )
      .addExtraButton((button) =>
        button
          .setIcon("cross")
          .setTooltip("Cancel")
          .onClick(() => this.close()),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
