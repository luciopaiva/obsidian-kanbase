import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type BaseBoardPlugin from "./main";

const CARD_TAG_POSITION_KEY = "cardTagPosition";
const CARD_TITLE_FONT_SIZE_KEY = "cardTitleFontSize";
const HIDE_BASE_FILTER_TAGS_KEY = "hideBaseFilterTags";

export const DEFAULT_CARD_TITLE_FONT_SIZE = 13;
export const MIN_CARD_TITLE_FONT_SIZE = 10;
export const MAX_CARD_TITLE_FONT_SIZE = 24;

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
      {
        name: "Card title font size",
        desc: "Set the card title text size in pixels.",
        control: {
          type: "slider",
          key: CARD_TITLE_FONT_SIZE_KEY,
          defaultValue: DEFAULT_CARD_TITLE_FONT_SIZE,
          min: MIN_CARD_TITLE_FONT_SIZE,
          max: MAX_CARD_TITLE_FONT_SIZE,
          step: 1,
        },
      },
      {
        name: "Hide Base filter tags",
        desc: "Hide tags on cards when a Base filter already requires them.",
        control: {
          type: "toggle",
          key: HIDE_BASE_FILTER_TAGS_KEY,
          defaultValue: true,
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === CARD_TAG_POSITION_KEY) {
      return this.baseBoardPlugin.getCardTagPosition();
    }
    if (key === CARD_TITLE_FONT_SIZE_KEY) {
      return this.baseBoardPlugin.getCardTitleFontSize();
    }
    if (key === HIDE_BASE_FILTER_TAGS_KEY) {
      return this.baseBoardPlugin.shouldHideBaseFilterTags();
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
    if (key === CARD_TITLE_FONT_SIZE_KEY && typeof value === "number") {
      return this.baseBoardPlugin.setCardTitleFontSize(value);
    }
    if (key === HIDE_BASE_FILTER_TAGS_KEY && typeof value === "boolean") {
      return this.baseBoardPlugin.setHideBaseFilterTags(value);
    }
  }
}
