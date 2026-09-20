import { BasesEntry, Notice, TFile } from "obsidian";
import { ORDER_PROPERTY } from "../support/constants";
import { generateOrderKey, isOrderKey, OrderValue } from "../support/order";
import type { KanbanView } from "../kanban-view";
import { InputModal } from "../ui/modals";

export class CardCreationManager {
  private view: KanbanView;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public startInline(columnName: string, orderedEntries: BasesEntry[]): void {
    const initialOrder = this.getInitialOrder(orderedEntries);
    new InputModal(
      this.view.app,
      `New card in ${columnName}`,
      "Card title…",
      (title: string) => {
        void this.createCard(title, columnName, initialOrder);
      },
    ).open();
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
      if (newFile) this.view.renderer.requestFocus(newFile.path);
    } catch (error) {
      new Notice(`Failed to create card: ${String(error)}`);
    }
  }
}
