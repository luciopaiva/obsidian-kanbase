import { addIcon, Plugin, QueryController, removeIcon } from "obsidian";
import { KanbanView } from "./kanban-view";
import { CreateBoardModal } from "./ui/modals";
import { BoardScaffolder } from "./board/board-scaffolder";
import {
  KanbaseSettingTab,
  DEFAULT_CARD_TITLE_FONT_SIZE,
  MAX_CARD_TITLE_FONT_SIZE,
  MIN_CARD_TITLE_FONT_SIZE,
} from "./settings";
import { KANBASE_ICON_ID, KANBASE_ICON_SVG } from "./icons";

export type CardTagPosition = "top" | "bottom";

/** Per-base column configuration */
export interface ColumnConfig {
  columns: string[];
}

export interface PluginData {
  columnConfigs: Record<string, ColumnConfig>;
  cardTagPosition: CardTagPosition;
  cardTitleFontSize: number;
  hideBaseFilterTags: boolean;
  hoverPreviewEnabled: boolean;
}

const DEFAULT_DATA: PluginData = {
  columnConfigs: {},
  cardTagPosition: "top",
  cardTitleFontSize: DEFAULT_CARD_TITLE_FONT_SIZE,
  hideBaseFilterTags: true,
  hoverPreviewEnabled: false,
};

// ---------------------------------------------------------------------------
//  Plugin
// ---------------------------------------------------------------------------

export default class KanbasePlugin extends Plugin {
  settings: PluginData = DEFAULT_DATA;
  private boardViews = new Set<KanbanView>();

  async onload() {
    await this.loadPluginData();
    addIcon(KANBASE_ICON_ID, KANBASE_ICON_SVG);
    const boardScaffolder = new BoardScaffolder(this.app);
    this.addSettingTab(new KanbaseSettingTab(this.app, this));
    this.registerHoverLinkSource("kanbase", {
      display: "Kanbase",
      defaultMod: false,
    });

    this.registerBasesView("kanbase", {
      name: "Kanbase",
      icon: KANBASE_ICON_ID,
      factory: (controller: QueryController, containerEl: HTMLElement) => {
        const view = new KanbanView(controller, containerEl, this);
        this.boardViews.add(view);
        view.register(() => this.boardViews.delete(view));
        return view;
      },
      options: () => KanbanView.getViewOptions(),
    });

    // -- Command: Create new board --------------------------------------------
    this.addCommand({
      id: "create-board",
      name: "Create new board",
      callback: () => {
        new CreateBoardModal(this.app, (config) => {
          void boardScaffolder.create(config);
        }).open();
      },
    });
  }

  onunload() {
    removeIcon(KANBASE_ICON_ID);
  }

  // -- Column config helpers --------------------------------------------------

  getColumnConfig(baseId: string): ColumnConfig | null {
    return this.settings.columnConfigs[baseId] ?? null;
  }

  async saveColumnConfig(baseId: string, config: ColumnConfig): Promise<void> {
    this.settings.columnConfigs[baseId] = config;
    await this.savePluginData();
  }

  getCardTagPosition(): CardTagPosition {
    return this.settings.cardTagPosition;
  }

  async setCardTagPosition(position: CardTagPosition): Promise<void> {
    this.settings.cardTagPosition = position;
    await this.savePluginData();
    for (const view of this.boardViews) view.updates.scheduleRender();
  }

  getCardTitleFontSize(): number {
    return this.settings.cardTitleFontSize;
  }

  async setCardTitleFontSize(size: number): Promise<void> {
    this.settings.cardTitleFontSize = this.normalizeCardTitleFontSize(size);
    await this.savePluginData();
    for (const view of this.boardViews) view.updates.scheduleRender();
  }

  shouldHideBaseFilterTags(): boolean {
    return this.settings.hideBaseFilterTags;
  }

  async setHideBaseFilterTags(hidden: boolean): Promise<void> {
    this.settings.hideBaseFilterTags = hidden;
    await this.savePluginData();
    for (const view of this.boardViews) view.updates.scheduleRender();
  }

  isHoverPreviewEnabled(): boolean {
    return this.settings.hoverPreviewEnabled;
  }

  async setHoverPreviewEnabled(enabled: boolean): Promise<void> {
    this.settings.hoverPreviewEnabled = enabled;
    await this.savePluginData();
  }

  // -- Persistence ------------------------------------------------------------

  async loadPluginData(): Promise<void> {
    const saved = (await this.loadData()) as PluginData | null | undefined;
    this.settings = Object.assign({}, DEFAULT_DATA, saved ?? {});
    if (!this.settings.columnConfigs) this.settings.columnConfigs = {};
    if (
      this.settings.cardTagPosition !== "top" &&
      this.settings.cardTagPosition !== "bottom"
    ) {
      this.settings.cardTagPosition = DEFAULT_DATA.cardTagPosition;
    }
    this.settings.cardTitleFontSize = this.normalizeCardTitleFontSize(
      this.settings.cardTitleFontSize,
    );
    if (typeof this.settings.hideBaseFilterTags !== "boolean") {
      this.settings.hideBaseFilterTags = DEFAULT_DATA.hideBaseFilterTags;
    }
    if (typeof this.settings.hoverPreviewEnabled !== "boolean") {
      this.settings.hoverPreviewEnabled = DEFAULT_DATA.hoverPreviewEnabled;
    }
  }

  async savePluginData(): Promise<void> {
    await this.saveData(this.settings);
  }

  private normalizeCardTitleFontSize(size: unknown): number {
    if (typeof size !== "number" || !Number.isFinite(size)) {
      return DEFAULT_CARD_TITLE_FONT_SIZE;
    }
    return Math.min(
      MAX_CARD_TITLE_FONT_SIZE,
      Math.max(MIN_CARD_TITLE_FONT_SIZE, Math.round(size)),
    );
  }
}
