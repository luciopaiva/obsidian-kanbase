import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type KanbasePlugin from "./main";

const CARD_TAG_POSITION_KEY = "cardTagPosition";
const CARD_TITLE_FONT_SIZE_KEY = "cardTitleFontSize";
const HIDE_BASE_FILTER_TAGS_KEY = "hideBaseFilterTags";
const HOVER_PREVIEW_ENABLED_KEY = "hoverPreviewEnabled";

export const DEFAULT_CARD_TITLE_FONT_SIZE = 13;
export const MIN_CARD_TITLE_FONT_SIZE = 10;
export const MAX_CARD_TITLE_FONT_SIZE = 24;

export class KanbaseSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly kanbasePlugin: KanbasePlugin,
  ) {
    super(app, kanbasePlugin);
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
      {
        name: "Hover preview",
        desc: "Show Obsidian's page preview when hovering over a card.",
        control: {
          type: "toggle",
          key: HOVER_PREVIEW_ENABLED_KEY,
          defaultValue: false,
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === CARD_TAG_POSITION_KEY) {
      return this.kanbasePlugin.getCardTagPosition();
    }
    if (key === CARD_TITLE_FONT_SIZE_KEY) {
      return this.kanbasePlugin.getCardTitleFontSize();
    }
    if (key === HIDE_BASE_FILTER_TAGS_KEY) {
      return this.kanbasePlugin.shouldHideBaseFilterTags();
    }
    if (key === HOVER_PREVIEW_ENABLED_KEY) {
      return this.kanbasePlugin.isHoverPreviewEnabled();
    }
    return undefined;
  }

  setControlValue(key: string, value: unknown): void | Promise<void> {
    if (
      key === CARD_TAG_POSITION_KEY &&
      (value === "top" || value === "bottom")
    ) {
      return this.kanbasePlugin.setCardTagPosition(value);
    }
    if (key === CARD_TITLE_FONT_SIZE_KEY && typeof value === "number") {
      return this.kanbasePlugin.setCardTitleFontSize(value);
    }
    if (key === HIDE_BASE_FILTER_TAGS_KEY && typeof value === "boolean") {
      return this.kanbasePlugin.setHideBaseFilterTags(value);
    }
    if (key === HOVER_PREVIEW_ENABLED_KEY && typeof value === "boolean") {
      return this.kanbasePlugin.setHoverPreviewEnabled(value);
    }
  }
}
