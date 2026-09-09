import { setTooltip, TFile } from "obsidian";
import { relativeLuminance } from "./color-utils";
import { countTagsByCard } from "./tag-counts";
import { ColorPickerModal } from "./color-picker-modal";
import type { KanbanView } from "./kanban-view";
import type { Tags } from "./tags";

export class TagFilterBar {
  private view: KanbanView;
  private tags: Tags;
  private tagCounts = new Map<string, number>();
  private activeFilters = new Set<string>();

  constructor(view: KanbanView, tags: Tags) {
    this.view = view;
    this.tags = tags;
  }

  public refresh(): void {
    const tagsByCard: string[][] = [];
    for (const group of this.view.currentGroups) {
      for (const entry of group.entries) {
        if (entry.file instanceof TFile) {
          tagsByCard.push(this.tags.extractTagsFromFile(entry.file));
        }
      }
    }
    this.tagCounts = countTagsByCard(tagsByCard);
  }

  public matches(file: TFile): boolean {
    if (this.activeFilters.size === 0) return true;
    const fileTags = this.tags.extractTagsFromFile(file);
    return Array.from(this.activeFilters).some((filter) =>
      fileTags.includes(filter),
    );
  }

  public render(container: HTMLElement, isVisible: boolean): void {
    if (!isVisible) return;
    if (this.tagCounts.size === 0 && this.activeFilters.size === 0) return;

    const boardEl = container.querySelector(".base-board-board");
    if (!boardEl) return;

    const barEl = container.createDiv({ cls: "base-board-filter-bar" });
    container.insertBefore(barEl, boardEl);

    const tagsArray = Array.from(this.tagCounts.keys()).sort();
    for (const activeTag of this.activeFilters) {
      if (!this.tagCounts.has(activeTag)) tagsArray.push(activeTag);
    }

    for (const tag of tagsArray) {
      this.renderTagPill(barEl, tag);
    }

    if (this.activeFilters.size > 0) {
      const clearButton = barEl.createSpan({
        cls: "base-board-filter-clear",
        text: "Clear",
      });
      clearButton.addEventListener("click", () => {
        this.activeFilters.clear();
        this.view.scheduleRender();
      });
    }
  }

  private renderTagPill(container: HTMLElement, tag: string): void {
    const count = this.tagCounts.get(tag) ?? 0;
    const pill = container.createSpan({ cls: "base-board-filter-pill" });
    pill.createSpan({ cls: "base-board-filter-label", text: tag });
    pill.createSpan({ cls: "base-board-filter-count", text: String(count) });
    pill.setAttr(
      "aria-label",
      `${tag}, ${count} ${count === 1 ? "card" : "cards"}`,
    );

    const tagColor = this.tags.getColorForTag(tag);
    pill.style.setProperty("--tag-color", tagColor);
    if (relativeLuminance(tagColor) === "dark") {
      pill.addClass("base-board-filter-pill-light");
    } else {
      pill.addClass("base-board-filter-pill-dark");
    }

    if (this.activeFilters.has(tag)) pill.addClass("is-active");

    setTooltip(
      pill,
      `${count} ${count === 1 ? "card" : "cards"} · Click to filter · Right-click to change color`,
    );

    pill.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      new ColorPickerModal(this.view.app, tag, tagColor, (color) =>
        this.tags.setColor(tag, color),
      ).open();
    });

    pill.addEventListener("click", () => {
      if (this.activeFilters.has(tag)) {
        this.activeFilters.delete(tag);
      } else {
        this.activeFilters.add(tag);
      }
      this.view.scheduleRender();
    });
  }
}
