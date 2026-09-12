import { setIcon, setTooltip, TFile } from "obsidian";
import { relativeLuminance } from "../support/color-utils";
import { countTagsByCard } from "./tag-counts";
import { ColorPickerModal } from "../ui/color-picker-modal";
import type { KanbanView } from "../kanban-view";
import type { Tags } from "./tags";
import {
  getDesktopTagFilterState,
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
          tagsByCard.push(this.tags.getTagsForCardDisplay(entry.file));
        }
      }
    }
    this.tagCounts = countTagsByCard(tagsByCard);
    for (const tag of this.filters.keys()) {
      if (this.tags.isTagHiddenByBaseFilter(tag)) this.filters.delete(tag);
    }
  }

  public matches(file: TFile): boolean {
    const fileTags = this.tags.extractTagsFromFile(file);
    return matchesTagFilters(fileTags, this.filters);
  }

  public render(container: HTMLElement, isVisible: boolean): void {
    if (!isVisible) return;
    if (this.tagCounts.size === 0 && this.filters.size === 0) return;

    const boardEl = container.querySelector(".kanbase-board");
    if (!boardEl) return;

    const barEl = container.createDiv({ cls: "kanbase-filter-bar" });
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
        cls: "kanbase-filter-clear",
        text: "Clear",
      });
      clearButton.addEventListener("click", () => {
        this.filters.clear();
        this.view.updates.scheduleRender();
      });
    }
  }

  private renderTagPill(container: HTMLElement, tag: string): void {
    const count = this.tagCounts.get(tag) ?? 0;
    const state = this.getFilterState(tag);
    const pill = container.createSpan({ cls: "kanbase-filter-pill" });
    const iconEl = pill.createSpan({ cls: "kanbase-filter-state-icon" });
    iconEl.setAttr("aria-hidden", "true");
    if (state !== "none") {
      setIcon(iconEl, state === "include" ? "lucide-filter" : "lucide-eye-off");
    }
    pill.createSpan({ cls: "kanbase-filter-label", text: tag });
    pill.createSpan({ cls: "kanbase-filter-count", text: String(count) });
    const cardCount = `${count} ${count === 1 ? "card" : "cards"}`;
    const clickAction = this.getClickAction(state);
    const shiftClickAction = this.getShiftClickAction(state);
    const tapAction = this.getTapAction(state);
    pill.setAttr(
      "aria-label",
      `${tag}, ${cardCount}, ${this.getStateLabel(state)}. ${clickAction}. ${shiftClickAction}. ${tapAction}.`,
    );

    const tagColor = this.tags.getColorForTag(tag);
    pill.style.setProperty("--tag-color", tagColor);
    if (relativeLuminance(tagColor) === "dark") {
      pill.addClass("kanbase-filter-pill-light");
    } else {
      pill.addClass("kanbase-filter-pill-dark");
    }

    if (state === "include") pill.addClass("is-active");
    if (state === "exclude") pill.addClass("is-excluded");

    let pointerType: string | null = null;
    pill.addEventListener("pointerdown", (event) => {
      pointerType = event.pointerType;
    });
    pill.addEventListener("pointercancel", () => {
      pointerType = null;
    });

    setTooltip(
      pill,
      `${cardCount} · ${clickAction} · ${shiftClickAction} · Right-click to change color`,
    );

    pill.addEventListener("contextmenu", (event) => {
      pointerType = null;
      event.preventDefault();
      new ColorPickerModal(this.view.app, tag, tagColor, (color) =>
        this.tags.setColor(tag, color),
      ).open();
    });

    pill.addEventListener("click", (event) => {
      const currentState = this.getFilterState(tag);
      const isTouchInput = pointerType === "touch" || pointerType === "pen";
      pointerType = null;
      const nextState = isTouchInput
        ? getNextTagFilterState(currentState)
        : getDesktopTagFilterState(currentState, event.shiftKey);
      if (nextState === "none") {
        this.filters.delete(tag);
      } else {
        this.filters.set(tag, nextState);
      }
      this.view.updates.scheduleRender();
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
    return state === "none" ? "Click to filter in" : "Click to clear filter";
  }

  private getShiftClickAction(state: TagFilterState): string {
    return state === "exclude"
      ? "Shift-click to clear filter"
      : "Shift-click to filter out";
  }

  private getTapAction(state: TagFilterState): string {
    if (state === "include") return "Tap to filter out";
    if (state === "exclude") return "Tap to clear filter";
    return "Tap to filter in";
  }
}
