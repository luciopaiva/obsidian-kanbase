import { Plugin, QueryController, TFolder, TAbstractFile } from "obsidian";
import { KanbanView } from "./kanban-view";
import { CreateBoardModal } from "./ui/modals";
import { updateBaseFolderReferences } from "./support/folder-rename";
import { BoardScaffolder } from "./board/board-scaffolder";
import {
  BaseBoardSettingTab,
  DEFAULT_CARD_TITLE_FONT_SIZE,
  MAX_CARD_TITLE_FONT_SIZE,
  MIN_CARD_TITLE_FONT_SIZE,
} from "./settings";

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

export default class BaseBoardPlugin extends Plugin {
  settings: PluginData = DEFAULT_DATA;
  private boardViews = new Set<KanbanView>();

  /** Folder rename mappings collected during one rename burst, pending flush. */
  private pendingFolderRenames: Array<{ oldPath: string; newPath: string }> =
    [];
  /** Debounce timer that flushes pendingFolderRenames once the burst settles. */
  private folderRenameFlushTimer: number | null = null;

  async onload() {
    await this.loadPluginData();
    const boardScaffolder = new BoardScaffolder(this.app);
    this.addSettingTab(new BaseBoardSettingTab(this.app, this));
    this.registerHoverLinkSource("base-board", {
      display: "Base Board",
      defaultMod: false,
    });

    this.registerBasesView("kanban", {
      name: "Kanban",
      icon: "lucide-kanban",
      factory: (controller: QueryController, containerEl: HTMLElement) => {
        const view = new KanbanView(controller, containerEl, this);
        this.boardViews.add(view);
        view.register(() => this.boardViews.delete(view));
        return view;
      },
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

    // -- Keep board filters in sync when their folder is renamed/moved --------
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.handleFolderRename(file, oldPath);
      }),
    );
  }

  onunload() {
    if (this.folderRenameFlushTimer !== null) {
      window.clearTimeout(this.folderRenameFlushTimer);
    }
  }

  // -- Folder rename sync -----------------------------------------------------

  /**
   * When a folder is renamed or moved, rewrite any .base board filter that
   * pointed at the old path so the board keeps working without a manual edit.
   *
   * To avoid race condition, burst of renaming events are collected, and once
   * a timeout is reached we flush and modify the path mappings in .base
   */
  private handleFolderRename(file: TAbstractFile, oldPath: string): void {
    const timeOut = 250;

    // Only folder moves change the folder a filter targets; ignore file renames.
    if (!(file instanceof TFolder)) return;

    const newPath = file.path;
    if (newPath === oldPath) return;

    this.pendingFolderRenames.push({ oldPath, newPath });

    // Debounce: reset the timer on every event so the flush runs only after
    // the rename burst has settled and Obsidian has finished moving files.
    if (this.folderRenameFlushTimer !== null) {
      window.clearTimeout(this.folderRenameFlushTimer);
    }
    this.folderRenameFlushTimer = window.setTimeout(() => {
      this.folderRenameFlushTimer = null;
      void this.flushFolderRenames();
    }, timeOut);
  }

  /** Apply all pending folder-rename mappings to every .base file. */
  private async flushFolderRenames(): Promise<void> {
    const renames = this.pendingFolderRenames;
    this.pendingFolderRenames = [];
    if (renames.length === 0) return;

    const baseFiles = this.app.vault
      .getFiles()
      .filter((f) => f.extension === "base");

    for (const baseFile of baseFiles) {
      try {
        let content = await this.app.vault.read(baseFile);
        let changed = false;
        for (const { oldPath, newPath } of renames) {
          const updated = updateBaseFolderReferences(content, oldPath, newPath);
          if (updated !== null) {
            content = updated;
            changed = true;
          }
        }
        if (changed) {
          await this.app.vault.modify(baseFile, content);
        }
      } catch (err) {
        console.error(
          `Base Board: failed to update folder references in "${baseFile.path}"`,
          err,
        );
      }
    }
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
