import { setIcon, setTooltip, TFile } from "obsidian";
import { relativeLuminance } from "./color-utils";
import { countTagsByCard } from "./tag-counts";
import { ColorPickerModal } from "./color-picker-modal";
import type { KanbanView } from "./kanban-view";
import type { Tags } from "./tags";
import {
  getNextTagFilterState,
  matchesTagFilters,
  type ActiveTagFilterState,
  type TagFilterState,
} from "./tag-filter-state";

export class TagFilterBar {
  private view: KanbanView;
  private tags: Tags;
  private tagCounts = new Map<string, number>();
  private filters = new Map<string, ActiveTagFilterState>();

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
    const fileTags = this.tags.extractTagsFromFile(file);
    return matchesTagFilters(fileTags, this.filters);
  }

  public render(container: HTMLElement, isVisible: boolean): void {
    if (!isVisible) return;
    if (this.tagCounts.size === 0 && this.filters.size === 0) return;

    const boardEl = container.querySelector(".base-board-board");
    if (!boardEl) return;

    const barEl = container.createDiv({ cls: "base-board-filter-bar" });
    container.insertBefore(barEl, boardEl);

    const tagsArray = Array.from(this.tagCounts.keys()).sort();
    for (const activeTag of this.filters.keys()) {
      if (!this.tagCounts.has(activeTag)) tagsArray.push(activeTag);
    }

    for (const tag of tagsArray) {
      this.renderTagPill(barEl, tag);
    }

    if (this.filters.size > 0) {
      const clearButton = barEl.createSpan({
        cls: "base-board-filter-clear",
        text: "Clear",
      });
      clearButton.addEventListener("click", () => {
        this.filters.clear();
        this.view.scheduleRender();
      });
    }
  }

  private renderTagPill(container: HTMLElement, tag: string): void {
    const count = this.tagCounts.get(tag) ?? 0;
    const state = this.getFilterState(tag);
    const pill = container.createSpan({ cls: "base-board-filter-pill" });
    const iconEl = pill.createSpan({ cls: "base-board-filter-state-icon" });
    iconEl.setAttr("aria-hidden", "true");
    if (state !== "none") {
      setIcon(iconEl, state === "include" ? "lucide-filter" : "lucide-eye-off");
    }
    pill.createSpan({ cls: "base-board-filter-label", text: tag });
    pill.createSpan({ cls: "base-board-filter-count", text: String(count) });
    pill.setAttr(
      "aria-label",
      `${tag}, ${count} ${count === 1 ? "card" : "cards"}, ${this.getStateLabel(state)}`,
    );

    const tagColor = this.tags.getColorForTag(tag);
    pill.style.setProperty("--tag-color", tagColor);
    if (relativeLuminance(tagColor) === "dark") {
      pill.addClass("base-board-filter-pill-light");
    } else {
      pill.addClass("base-board-filter-pill-dark");
    }

    if (state === "include") pill.addClass("is-active");
    if (state === "exclude") pill.addClass("is-excluded");

    setTooltip(
      pill,
      `${count} ${count === 1 ? "card" : "cards"} · ${this.getClickAction(state)} · Right-click to change color`,
    );

    pill.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      new ColorPickerModal(this.view.app, tag, tagColor, (color) =>
        this.tags.setColor(tag, color),
      ).open();
    });

    pill.addEventListener("click", () => {
      const nextState = getNextTagFilterState(this.getFilterState(tag));
      if (nextState === "none") {
        this.filters.delete(tag);
      } else {
        this.filters.set(tag, nextState);
      }
      this.view.scheduleRender();
    });
  }

  private getFilterState(tag: string): TagFilterState {
    return this.filters.get(tag) ?? "none";
  }

  private getStateLabel(state: TagFilterState): string {
    if (state === "include") return "filtering in";
    if (state === "exclude") return "filtering out";
    return "not filtering";
  }

  private getClickAction(state: TagFilterState): string {
    if (state === "include") return "Click to filter out";
    if (state === "exclude") return "Click to clear filter";
    return "Click to filter in";
  }
}
