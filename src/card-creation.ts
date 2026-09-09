import { BasesEntry, Notice } from "obsidian";
import { CONFIG_KEY_ADD_TO_TOP, ORDER_PROPERTY } from "./constants";
import { generateOrderKey, isOrderKey, OrderValue } from "./order";
import type { KanbanView } from "./kanban-view";

export class CardCreationManager {
  private view: KanbanView;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public startInline(
    triggerEl: HTMLElement,
    columnName: string,
    orderedEntries: BasesEntry[],
  ): void {
    const initialOrder = this.getInitialOrder(orderedEntries);
    const columnEl = triggerEl.closest(".base-board-column");
    const cardsEl =
      (columnEl?.querySelector(".base-board-cards") as HTMLElement | null) ??
      triggerEl.parentElement!;

    triggerEl.classList.add("base-board-hidden");
    const inputWrapper = cardsEl.createDiv({
      cls: "base-board-add-card-input-wrapper",
    });
    const input = inputWrapper.createEl("input", {
      cls: "base-board-add-card-input",
      attr: { type: "text", placeholder: "Card title…" },
    });
    input.focus();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const title = input.value.trim();
      inputWrapper.remove();
      triggerEl.classList.remove("base-board-hidden");
      if (title) {
        await this.createCard(title, columnName, initialOrder);
      }
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        committed = true;
        inputWrapper.remove();
        triggerEl.classList.remove("base-board-hidden");
      }
    });
    input.addEventListener("blur", () => {
      void commit();
    });
  }

  private getInitialOrder(orderedEntries: BasesEntry[]): OrderValue {
    if (orderedEntries.length === 0) return generateOrderKey(null, null);

    const addToTop = !!this.view.config?.get(CONFIG_KEY_ADD_TO_TOP);
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
    const groupByProperty = this.view.getGroupByProperty();
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
      this.view.applyGroupByValue(frontmatter, groupByProperty, columnName);
      frontmatter[ORDER_PROPERTY] = order;
    };

    try {
      await this.view.createFileForView(title, applyDefaults);
    } catch (error) {
      new Notice(`Failed to create card: ${String(error)}`);
    }
  }
}
