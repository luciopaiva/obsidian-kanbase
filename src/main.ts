import { Plugin, QueryController, TFolder, TAbstractFile } from "obsidian";
import { KanbanView } from "./kanban-view";
import { CreateBoardModal } from "./modals";
import { updateBaseFolderReferences } from "./folder-rename";
import { BoardScaffolder } from "./board-scaffolder";

/** Per-base column configuration */
export interface ColumnConfig {
  columns: string[];
}

export interface PluginData {
  columnConfigs: Record<string, ColumnConfig>;
}

const DEFAULT_DATA: PluginData = {
  columnConfigs: {},
};

// ---------------------------------------------------------------------------
//  Plugin
// ---------------------------------------------------------------------------

export default class BaseBoardPlugin extends Plugin {
  data_: PluginData = DEFAULT_DATA;

  /** Folder rename mappings collected during one rename burst, pending flush. */
  private pendingFolderRenames: Array<{ oldPath: string; newPath: string }> =
    [];
  /** Debounce timer that flushes pendingFolderRenames once the burst settles. */
  private folderRenameFlushTimer: number | null = null;

  async onload() {
    await this.loadPluginData();
    const boardScaffolder = new BoardScaffolder(this.app);

    this.registerBasesView("kanban", {
      name: "Kanban",
      icon: "lucide-kanban",
      factory: (controller: QueryController, containerEl: HTMLElement) =>
        new KanbanView(controller, containerEl, this),
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
    return this.data_.columnConfigs[baseId] ?? null;
  }

  async saveColumnConfig(baseId: string, config: ColumnConfig): Promise<void> {
    this.data_.columnConfigs[baseId] = config;
    await this.savePluginData();
  }

  // -- Persistence ------------------------------------------------------------

  async loadPluginData(): Promise<void> {
    const saved = (await this.loadData()) as PluginData | null | undefined;
    this.data_ = Object.assign({}, DEFAULT_DATA, saved ?? {});
    if (!this.data_.columnConfigs) this.data_.columnConfigs = {};
  }

  async savePluginData(): Promise<void> {
    await this.saveData(this.data_);
  }
}
