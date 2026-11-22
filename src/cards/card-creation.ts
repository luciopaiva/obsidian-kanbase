import { BasesEntry, Notice, TFile } from "obsidian";
import { ORDER_PROPERTY, PARENT_PROPERTY } from "../support/constants";
import { generateOrderKey, isOrderKey, OrderValue } from "../support/order";
import { addRowValue } from "../board/swimlanes";
import { makeParentLink } from "./card-hierarchy";
import type { KanbanView } from "../kanban-view";
import { InputModal } from "../ui/modals";

export class CardCreationManager {
  private view: KanbanView;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public startInline(
    columnName: string,
    orderedEntries: BasesEntry[],
    rowValue?: string,
  ): void {
    const initialOrder = this.getInitialOrder(orderedEntries);
    new InputModal(
      this.view.app,
      `New card in ${columnName}`,
      "Card title…",
      (title: string) => {
        void this.createCard(title, columnName, initialOrder, rowValue);
      },
    ).open();
  }

  /**
   * Create a child card of `parentFile`: same column and same tags as the
   * parent, plus a `kanbase_parent` link back to it. The swimlane row (e.g. a
   * "weight" property) is deliberately not inherited — children are small
   * tasks and belong in the board's "no value" row.
   */
  public startChild(parentFile: TFile, columnName: string): void {
    const orderedEntries = this.getOrderedEntries(columnName);
    const initialOrder = this.getInitialOrder(orderedEntries);
    new InputModal(
      this.view.app,
      `New child of ${parentFile.basename}`,
      "Card title…",
      (title: string) => {
        void this.createCard(
          title,
          columnName,
          initialOrder,
          undefined,
          parentFile,
        );
      },
    ).open();
  }

  /** Entries of a column, in display order, for computing the initial order. */
  private getOrderedEntries(columnName: string): BasesEntry[] {
    const group = this.view.currentGroups.find(
      (candidate) => this.view.getColumnName(candidate.key) === columnName,
    );
    return [...(group?.entries ?? [])].sort((a, b) => {
      const pathA = a.file?.path ?? "";
      const pathB = b.file?.path ?? "";
      const orderComparison = this.view.cardMoves.compareCardOrder(
        columnName,
        pathA,
        pathB,
      );
      if (orderComparison !== 0) return orderComparison;
      return (a.file?.stat.ctime ?? 0) - (b.file?.stat.ctime ?? 0);
    });
  }

  private getInitialOrder(orderedEntries: BasesEntry[]): OrderValue {
    if (orderedEntries.length === 0) return generateOrderKey(null, null);

    const addToTop = this.view.boardConfig.shouldAddNewCardsToTop();
    const orders = orderedEntries.map((entry) =>
      entry.file?.path
        ? this.view.cardMoves.getFileOrder(entry.file.path)
        : null,
    );
    if (orders.every(isOrderKey)) {
      return addToTop
        ? generateOrderKey(null, orders[0])
        : generateOrderKey(orders[orders.length - 1], null);
    }

    const numericOrders = orders.filter(
      (order): order is number => typeof order === "number",
    );
    return addToTop
      ? Math.min(...numericOrders, 0) - 1000
      : Math.max(...numericOrders, -1000) + 1000;
  }

  private async createCard(
    title: string,
    columnName: string,
    order: OrderValue,
    rowValue?: string,
    parentFile?: TFile,
  ): Promise<void> {
    const groupByProperty = this.view.boardConfig.getGroupByProperty();
    if (!groupByProperty) {
      new Notice("Cannot create card: no group by property configured.");
      return;
    }

    const applyDefaults = (frontmatter: Record<string, unknown>) => {
      const newItemProperties = this.view.config?.get("newItemProperties");
      if (newItemProperties && typeof newItemProperties === "object") {
        const properties = newItemProperties as Record<string, unknown>;
        for (const key of Object.keys(properties)) {
          if (key !== "__proto__" && key !== "constructor") {
            frontmatter[key] = properties[key];
          }
        }
      }
      this.view.boardConfig.applyGroupByValue(
        frontmatter,
        groupByProperty,
        columnName,
      );
      if (parentFile) {
        // Child card: link back to the parent and inherit its tags, but not
        // the swimlane row — children stay in the board's "no value" row
        // instead of the parent's.
        frontmatter[PARENT_PROPERTY] = makeParentLink(parentFile.path);
        const parentTags = this.view.tags.extractTagsFromFile(parentFile);
        if (parentTags.length > 0) {
          frontmatter.tags = [...parentTags];
        }
      } else if (rowValue) {
        const swimlaneProperty = this.view.boardConfig.getSwimlaneProperty();
        if (swimlaneProperty) {
          addRowValue(frontmatter, swimlaneProperty, rowValue);
        }
      }
      frontmatter[ORDER_PROPERTY] = order;
    };

    try {
      // createFileForView doesn't return the created file, so capture it
      // via the vault event to scroll to and highlight it once rendered.
      const createdFile = new Promise<TFile | null>((resolve) => {
        const ref = this.view.app.vault.on("create", (file) => {
          this.view.app.vault.offref(ref);
          resolve(file instanceof TFile ? file : null);
        });
        window.setTimeout(() => {
          this.view.app.vault.offref(ref);
          resolve(null);
        }, 3000);
      });
      await this.view.createFileForView(title, applyDefaults);
      const newFile = await createdFile;
      if (newFile) {
        if (parentFile) {
          try {
            await this.moveBesideParent(newFile, parentFile);
          } catch (error) {
            new Notice(
              `Could not move card next to its parent: ${String(error)}`,
            );
          }
        }
        this.view.renderer.requestFocus(newFile.path);
      }
    } catch (error) {
      new Notice(`Failed to create card: ${String(error)}`);
    }
  }

  /**
   * Move a freshly created child card into the same folder as its parent,
   * whatever folder the view's `newItemFolder` would have used. Keeps the
   * name unique when the target folder already has a note with that name.
   */
  private async moveBesideParent(
    file: TFile,
    parentFile: TFile,
  ): Promise<void> {
    const folder = parentFile.parent;
    const folderPath = folder && folder.path !== "/" ? folder.path : "";
    const join = (name: string) =>
      folderPath ? `${folderPath}/${name}` : name;

    if (join(file.name) === file.path) return;

    let name = file.name;
    if (this.view.app.vault.getAbstractFileByPath(join(name))) {
      const dotIndex = file.name.lastIndexOf(".");
      const baseName = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
      const extension = dotIndex > 0 ? file.name.slice(dotIndex) : "";
      let counter = 1;
      while (
        this.view.app.vault.getAbstractFileByPath(
          join(`${baseName} ${counter}${extension}`),
        )
      ) {
        counter++;
      }
      name = `${baseName} ${counter}${extension}`;
    }

    await this.view.app.fileManager.renameFile(file, join(name));
  }
}
