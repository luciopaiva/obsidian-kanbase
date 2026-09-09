import { TFile, WorkspaceLeaf } from "obsidian";
import type { KanbanView } from "./kanban-view";
import { CardDetailModal } from "./card-detail-modal";
import { isLeafAttached } from "./base-view-context";

export class CardNavigation {
  private detailLeaf: WorkspaceLeaf | null = null;

  constructor(private readonly view: KanbanView) {}

  public open(file: TFile): void {
    const behavior = this.view.boardConfig.getCardOpenBehavior();
    if (behavior === "split") {
      if (this.detailLeaf && isLeafAttached(this.view.app, this.detailLeaf)) {
        void this.detailLeaf.openFile(file);
      } else {
        this.detailLeaf = this.view.app.workspace.getLeaf("split", "vertical");
        void this.detailLeaf.openFile(file);
      }
    } else if (behavior === "tab") {
      void this.view.app.workspace.getLeaf("tab").openFile(file);
    } else if (behavior === "active") {
      void this.view.app.workspace.getLeaf(false).openFile(file);
    } else {
      new CardDetailModal(this.view.app, file, this.view).open();
    }
  }

  public openInNewTab(file: TFile): void {
    void this.view.app.workspace.getLeaf("tab").openFile(file);
  }

  public resolveFile(filePath: string): TFile | null {
    const file = this.view.app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  }
}
