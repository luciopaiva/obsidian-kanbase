import { setIcon, setTooltip, TFile } from "obsidian";
import { relativeLuminance } from "../support/color-utils";
import { countTagsByCard } from "./tag-counts";
import { TagSortControl } from "./tag-sort-control";
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
  private hasLoadedPersistedFilters = false;
  private tagSearch = "";

  constructor(view: KanbanView, tags: Tags) {
    this.view = view;
    this.tags = tags;
  }

  public refresh(): void {
    if (!this.hasLoadedPersistedFilters) {
      this.hasLoadedPersistedFilters = true;
      const stored = this.view.preferences.getTagFilters();
      for (const tag of Object.keys(stored)) {
        this.filters.set(tag, stored[tag]);
      }
    }

    const tagsByCard: string[][] = [];
    for (const group of this.view.currentGroups) {
      for (const entry of group.entries) {
        if (entry.file instanceof TFile) {
          tagsByCard.push(this.tags.getTagsForCardDisplay(entry.file));
        }
      }
    }
    this.tagCounts = countTagsByCard(tagsByCard);
    let removedHiddenTag = false;
    for (const tag of this.filters.keys()) {
      if (this.tags.isTagHiddenByBaseFilter(tag)) {
        this.filters.delete(tag);
        removedHiddenTag = true;
      }
    }
    if (removedHiddenTag) this.persistFilters();
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

    const controlsEl = barEl.createDiv({ cls: "kanbase-filter-controls" });
    const searchInput = controlsEl.createEl("input", {
      cls: "kanbase-filter-search",
      type: "search",
      placeholder: "Filter tags…",
      attr: { "aria-label": "Filter tags by name" },
    });
    searchInput.value = this.tagSearch;
    let sortOrder = this.view.preferences.getTagSortOrder();
    const pillsEl = barEl.createDiv({ cls: "kanbase-filter-tags" });

    const tagsArray = Array.from(this.tagCounts.keys());
    for (const activeTag of this.filters.keys()) {
      if (!this.tagCounts.has(activeTag)) tagsArray.push(activeTag);
    }
    tagsArray.sort();

    const renderMatchingTags = (): void => {
      pillsEl.empty();
      const query = this.tagSearch.trim().replace(/^#/, "").toLowerCase();
      const matchingTags = tagsArray.filter((tag) =>
        tag.toLowerCase().includes(query),
      );
      if (sortOrder === "count") {
        // Stable sorting preserves alphabetical order for equal counts.
        matchingTags.sort(
          (a, b) => (this.tagCounts.get(b) ?? 0) - (this.tagCounts.get(a) ?? 0),
        );
      }
      for (const tag of matchingTags) {
        this.renderTagPill(pillsEl, tag);
      }
      if (matchingTags.length === 0) {
        pillsEl.createSpan({
          cls: "kanbase-filter-empty",
          text: "No matching tags",
          attr: { role: "status" },
        });
      }
    };
    new TagSortControl(controlsEl, sortOrder, (order) => {
      sortOrder = order;
      this.view.preferences.setTagSortOrder(order);
      renderMatchingTags();
    });
    searchInput.addEventListener("input", () => {
      this.tagSearch = searchInput.value;
      renderMatchingTags();
    });
    renderMatchingTags();

    if (this.filters.size > 0) {
      const clearButton = barEl.createSpan({
        cls: "kanbase-filter-clear",
        text: "Clear",
      });
      clearButton.addEventListener("click", () => {
        this.filters.clear();
        this.persistFilters();
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
      this.persistFilters();
      this.view.updates.scheduleRender();
    });
  }

  private persistFilters(): void {
    const filters: Record<string, ActiveTagFilterState> = {};
    for (const [tag, state] of this.filters) {
      filters[tag] = state;
    }
    this.view.preferences.setTagFilters(filters);
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
