import {
  AbstractInputSuggest,
  App,
  Menu,
  Modal,
  Setting,
  setIcon,
  setTooltip,
  TextComponent,
} from "obsidian";
import type { KanbanView } from "../kanban-view";

export class BoardMoreMenu {
  constructor(private readonly view: KanbanView) {}

  public render(container: HTMLElement): void {
    const button = container.createEl("button", {
      cls: "clickable-icon kanbase-toolbar-button",
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
        new PropertyFieldModal(this.view, {
          title: "Cover property",
          description: "The file property used for card cover images.",
          placeholder: "E.g. cover",
          initialValue: this.view.boardConfig.getCardCoverProperty() ?? "",
          onSave: (value) =>
            this.view.boardConfig.setCardCoverProperty(value ?? ""),
        }).open();
      }),
    );
    menu.addItem((item) =>
      item.setTitle("Set swimlane property…").onClick(() => {
        new PropertyFieldModal(this.view, {
          title: "Swimlane property",
          description:
            "The file property used to split cards into swimlane rows. Leave empty to disable swimlanes.",
          placeholder: "E.g. priority",
          initialValue: this.view.boardConfig.getSwimlaneProperty() ?? "",
          onSave: (value) => this.view.boardConfig.setSwimlaneProperty(value),
        }).open();
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

interface PropertyFieldOptions {
  title: string;
  description: string;
  placeholder: string;
  initialValue: string;
  onSave: (value: string | null) => void;
}

/** Generic "pick a frontmatter property" modal, reused for cover/swimlane config. */
class PropertyFieldModal extends Modal {
  private property: string;
  private textComponent: TextComponent | undefined;

  constructor(
    view: KanbanView,
    private readonly options: PropertyFieldOptions,
  ) {
    super(view.app);
    this.property = options.initialValue;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: this.options.title });

    new Setting(this.contentEl)
      .setName("Property")
      .setDesc(this.options.description)
      .addText((text) => {
        this.textComponent = text;
        text
          .setPlaceholder(this.options.placeholder)
          .setValue(this.property)
          .onChange((value) => {
            this.property = value;
          });
        new PropertySuggest(this.app, text.inputEl).onSelect((value) => {
          text.setValue(value);
          this.property = value;
        });
      })
      .addExtraButton((button) =>
        button
          .setIcon("x")
          .setTooltip("Clear")
          .onClick(() => {
            this.property = "";
            this.textComponent?.setValue("");
          }),
      );

    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            const trimmed = this.property.trim();
            this.options.onSave(trimmed === "" ? null : trimmed);
            this.close();
          }),
      )
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.close()),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** Type-ahead suggestions sourced from frontmatter property names used in the vault. */
class PropertySuggest extends AbstractInputSuggest<string> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): string[] {
    const lower = query.toLowerCase();
    return this.getAllPropertyNames().filter((name) =>
      name.toLowerCase().includes(lower),
    );
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  private getAllPropertyNames(): string[] {
    const names = new Set<string>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const frontmatter =
        this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter) continue;
      for (const key of Object.keys(frontmatter)) {
        if (key === "position") continue;
        names.add(key);
      }
    }
    return Array.from(names).sort();
  }
}
