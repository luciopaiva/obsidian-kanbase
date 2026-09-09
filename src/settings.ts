import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type BaseBoardPlugin from "./main";

const CARD_TAG_POSITION_KEY = "cardTagPosition";

export class BaseBoardSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly baseBoardPlugin: BaseBoardPlugin,
  ) {
    super(app, baseBoardPlugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Card tag position",
        desc: "Choose where tags appear within cards.",
        control: {
          type: "dropdown",
          key: CARD_TAG_POSITION_KEY,
          defaultValue: "top",
          options: {
            top: "Top of card",
            bottom: "Bottom of card",
          },
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === CARD_TAG_POSITION_KEY) {
      return this.baseBoardPlugin.getCardTagPosition();
    }
    return undefined;
  }

  setControlValue(key: string, value: unknown): void | Promise<void> {
    if (
      key === CARD_TAG_POSITION_KEY &&
      (value === "top" || value === "bottom")
    ) {
      return this.baseBoardPlugin.setCardTagPosition(value);
    }
  }
}
