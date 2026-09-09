import { BasesEntry, BasesEntryGroup, TFile } from "obsidian";
import { ORDER_PROPERTY } from "./constants";
import {
  compareOrderValues,
  generateOrderKeys,
  isOrderKey,
  OrderValue,
  readOrderValue,
} from "./order";
import type { KanbanView } from "./kanban-view";

export class CardMoveCoordinator {
  private view: KanbanView;
  private optimisticMoves = new Map<string, string>();
  private optimisticColumnOrders = new Map<string, string[]>();

  constructor(view: KanbanView) {
    this.view = view;
  }

  public getFileOrder(filePath: string): OrderValue {
    const file = this.view.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return null;
    const cache = this.view.app.metadataCache.getFileCache(file);
    return readOrderValue(cache?.frontmatter?.[ORDER_PROPERTY]);
  }

  public compareCardOrder(
    columnName: string,
    pathA: string,
    pathB: string,
  ): number {
    const optimisticOrder = this.optimisticColumnOrders.get(columnName);
    if (optimisticOrder) {
      const indexA = optimisticOrder.indexOf(pathA);
      const indexB = optimisticOrder.indexOf(pathB);
      if (indexA !== -1 || indexB !== -1) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }
    }
    return compareOrderValues(
      this.getFileOrder(pathA),
      this.getFileOrder(pathB),
    );
  }

  public getEntriesForColumn(
    columnName: string,
    group: BasesEntryGroup | null,
  ): BasesEntry[] {
    const entries = [...(group?.entries ?? [])].filter((entry) => {
      const path = entry.file?.path;
      const optimisticColumn = path ? this.optimisticMoves.get(path) : null;
      return !optimisticColumn || optimisticColumn === columnName;
    });
    const present = new Set(entries.map((entry) => entry.file?.path));

    for (const entry of this.view.data?.data ?? []) {
      const path = entry.file?.path;
      if (
        path &&
        this.optimisticMoves.get(path) === columnName &&
        !present.has(path)
      ) {
        entries.push(entry);
      }
    }
    return entries;
  }

  public async handleDrop(
    filePath: string,
    targetColumnName: string,
    orderedPaths: string[],
  ): Promise<void> {
    const groupByProperty = this.view.boardConfig.getGroupByProperty();
    if (!groupByProperty) {
      throw new Error("Cannot move a card without a group by property");
    }

    const selectedSnapshot = this.view.cardSelection.snapshot();
    const isMultiDrag =
      selectedSnapshot.size > 1 && selectedSnapshot.has(filePath);
    const otherSelected = isMultiDrag
      ? Array.from(selectedSnapshot).filter(
          (path) => path !== filePath && !orderedPaths.includes(path),
        )
      : [];

    const fullOrderedPaths = [...orderedPaths];
    if (otherSelected.length > 0) {
      const dropIndex = fullOrderedPaths.indexOf(filePath);
      const insertAt =
        dropIndex !== -1 ? dropIndex + 1 : fullOrderedPaths.length;
      fullOrderedPaths.splice(insertAt, 0, ...otherSelected);
    }

    const pathsToMove = isMultiDrag ? [filePath, ...otherSelected] : [filePath];
    for (const path of pathsToMove) {
      this.optimisticMoves.set(path, targetColumnName);
    }
    this.optimisticColumnOrders.set(targetColumnName, fullOrderedPaths);

    try {
      await this.view.applyBatchUpdate(async () => {
        const movePromises = pathsToMove.map((path) => {
          const file = this.view.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile)) return Promise.resolve();
          if (this.getCardSourceColumn(path) === targetColumnName) {
            return Promise.resolve();
          }
          return this.view.app.fileManager.processFrontMatter(
            file,
            (frontmatter: Record<string, unknown>) => {
              this.view.boardConfig.applyGroupByValue(
                frontmatter,
                groupByProperty,
                targetColumnName,
              );
            },
          );
        });
        await Promise.all(movePromises);
        await this.writeCardOrder(fullOrderedPaths, pathsToMove);
      });
    } catch (error) {
      this.clearOptimisticMoves(pathsToMove, targetColumnName);
      this.view.scheduleRender();
      throw error;
    }
  }

  public async movePathsToColumn(
    filePaths: string[],
    targetColumn: string,
    groupByProperty: string,
  ): Promise<void> {
    const selected = new Set(filePaths);
    const orderedPaths = this.getOrderedPathsForColumn(targetColumn).filter(
      (path) => !selected.has(path),
    );
    orderedPaths.push(...filePaths);

    await this.view.applyBatchUpdate(async () => {
      const updates = filePaths.map((filePath) => {
        const file = this.view.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return Promise.resolve();
        return this.view.app.fileManager.processFrontMatter(
          file,
          (frontmatter: Record<string, unknown>) => {
            this.view.boardConfig.applyGroupByValue(
              frontmatter,
              groupByProperty,
              targetColumn,
            );
          },
        );
      });
      await Promise.all(updates);
      await this.writeCardOrder(orderedPaths, filePaths);
    });
  }

  public acknowledge(): void {
    const confirmedPaths: string[] = [];
    for (const [path, expectedColumn] of this.optimisticMoves) {
      if (
        this.findCardColumn(this.view.data?.groupedData ?? [], path) ===
        expectedColumn
      ) {
        confirmedPaths.push(path);
      }
    }
    for (const path of confirmedPaths) this.optimisticMoves.delete(path);

    for (const [columnName, orderedPaths] of this.optimisticColumnOrders) {
      if (orderedPaths.every((path) => !this.optimisticMoves.has(path))) {
        this.optimisticColumnOrders.delete(columnName);
      }
    }
  }

  private getOrderedPathsForColumn(columnName: string): string[] {
    const group = this.view.currentGroups.find(
      (candidate) => this.view.getColumnName(candidate.key) === columnName,
    );
    const paths = (group?.entries ?? [])
      .map((entry) => entry.file?.path)
      .filter((path): path is string => typeof path === "string");
    return paths.sort((pathA, pathB) =>
      compareOrderValues(this.getFileOrder(pathA), this.getFileOrder(pathB)),
    );
  }

  private clearOptimisticMoves(paths: string[], columnName: string): void {
    for (const path of paths) this.optimisticMoves.delete(path);
    this.optimisticColumnOrders.delete(columnName);
  }

  private async writeCardOrder(
    orderedPaths: string[],
    pathsToAssign: string[],
  ): Promise<void> {
    if (pathsToAssign.length === 0) return;

    const startIndex = orderedPaths.indexOf(pathsToAssign[0]);
    const previousPath = startIndex > 0 ? orderedPaths[startIndex - 1] : null;
    const nextPath =
      startIndex + pathsToAssign.length < orderedPaths.length
        ? orderedPaths[startIndex + pathsToAssign.length]
        : null;
    const existingPaths = orderedPaths.filter(
      (path) => !pathsToAssign.includes(path),
    );
    const hasLegacyOrder = existingPaths.some(
      (path) => !isOrderKey(this.getFileOrder(path)),
    );
    const pathsToWrite = hasLegacyOrder ? orderedPaths : pathsToAssign;
    const previousOrder = previousPath ? this.getFileOrder(previousPath) : null;
    const followingOrder = nextPath ? this.getFileOrder(nextPath) : null;
    const newOrders = hasLegacyOrder
      ? generateOrderKeys(null, null, orderedPaths.length)
      : generateOrderKeys(
          isOrderKey(previousOrder) ? previousOrder : null,
          isOrderKey(followingOrder) ? followingOrder : null,
          pathsToAssign.length,
        );

    await Promise.all(
      pathsToWrite.map((cardPath, index) => {
        const file = this.view.app.vault.getAbstractFileByPath(cardPath);
        if (!(file instanceof TFile)) return Promise.resolve();
        const orderValue = hasLegacyOrder
          ? newOrders[index]
          : newOrders[pathsToAssign.indexOf(cardPath)];
        return this.view.app.fileManager.processFrontMatter(
          file,
          (frontmatter: Record<string, unknown>) => {
            frontmatter[ORDER_PROPERTY] = orderValue;
          },
        );
      }),
    );
  }

  private getCardSourceColumn(filePath: string): string | null {
    return this.findCardColumn(this.view.currentGroups, filePath);
  }

  private findCardColumn(
    groups: BasesEntryGroup[],
    filePath: string,
  ): string | null {
    for (const group of groups) {
      for (const entry of group.entries) {
        if (entry.file?.path === filePath) {
          return this.view.getColumnName(group.key);
        }
      }
    }
    return null;
  }
}
