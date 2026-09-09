import type { KanbanView } from "./kanban-view";
import { CONFIG_KEY_TAG_COLORS } from "./constants";
import { TFile } from "obsidian";
import { TagEditModal } from "./tag-edit-modal";
import { getTagsRequiredByFilters } from "./base-filter-tags";
import type { BasesConfigFileFilter } from "obsidian";

interface SerializableBasesFilter {
  serialize(): BasesConfigFileFilter;
}

export class Tags {
  private view: KanbanView;
  private tagsRequiredByBaseFilters = new Set<string>();

  constructor(view: KanbanView) {
    this.view = view;
  }

  public getColors(): Record<string, string> {
    const raw = this.view.config?.get(CONFIG_KEY_TAG_COLORS);
    return raw && typeof raw === "object"
      ? (raw as Record<string, string>)
      : {};
  }

  public getDeterministicColor(tag: string): string {
    const DEFAULT_COLORS = [
      "#f87168", // Red
      "#fbbc04", // Orange
      "#fcc934", // Yellow
      "#34a853", // Green
      "#4285f4", // Blue
      "#a142f4", // Purple
      "#f442a1", // Pink
      "#20c997", // Teal
      "#fd7e14", // Orange
      "#6f42c1", // Indigo
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (
      DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length] ||
      DEFAULT_COLORS[0]
    );
  }

  public getColorForTag(tag: string): string {
    const customColors = this.getColors();
    return customColors[tag] || this.getDeterministicColor(tag);
  }

  public setColor(tag: string, color: string): void {
    const colors = this.getColors();
    if (color) {
      colors[tag] = color;
    } else {
      delete colors[tag];
    }
    this.view.config?.set(CONFIG_KEY_TAG_COLORS, colors);
    this.view.scheduleRender();
  }

  public extractTagsFromFile(file: TFile): string[] {
    const cache = this.view.app.metadataCache.getFileCache(file);
    const tags = (cache?.frontmatter?.tags ??
      cache?.frontmatter?.tag) as unknown;
    let fileTags: string[] = [];
    if (Array.isArray(tags)) {
      fileTags = tags.filter((t): t is string => typeof t === "string");
    } else if (typeof tags === "string") {
      fileTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);
    }
    // Strip '#' prefix — Obsidian's MetadataCache sometimes normalises
    // frontmatter tags with a leading '#' (e.g. "#my-tag" instead of "my-tag").
    return fileTags.map((t) => (t.startsWith("#") ? t.slice(1) : t));
  }

  public promptEditTags(file: TFile): void {
    const currentTags = this.extractTagsFromFile(file);
    new TagEditModal(this.view.app, currentTags, this, (newTags: string[]) => {
      void this.view.app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          if (newTags.length === 0) {
            delete fm.tags;
            delete fm.tag;
          } else {
            fm.tags = newTags;
          }
        },
      );
    }).open();
  }

  /** Refresh the tags made redundant by the current Bases filters. */
  public refreshBaseFilterTags(): void {
    this.tagsRequiredByBaseFilters = getTagsRequiredByFilters(
      this.getSerializedBaseFilters(),
    );
  }

  public getTagsForCardDisplay(file: TFile): string[] {
    return this.extractTagsFromFile(file).filter(
      (tag) => !this.tagsRequiredByBaseFilters.has(tag),
    );
  }

  /**
   * Obsidian does not expose Base filters on the public custom-view API, but
   * the runtime view config retains the parsed global and per-view filters.
   * Treat this as optional: if the internal shape changes, hide no tags.
   */
  private getSerializedBaseFilters(): BasesConfigFileFilter[] {
    const config = this.view.config as typeof this.view.config & {
      filters?: SerializableBasesFilter | null;
      query?: { filters?: SerializableBasesFilter | null };
    };
    const runtimeFilters = [config.query?.filters, config.filters];
    const serialized: BasesConfigFileFilter[] = [];

    for (const filter of runtimeFilters) {
      if (!filter || typeof filter.serialize !== "function") continue;
      try {
        serialized.push(filter.serialize());
      } catch {
        // Internal API mismatch: leave this filter unsupported and visible.
      }
    }

    return serialized;
  }
}
