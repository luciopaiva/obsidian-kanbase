import {
  BasesEntry,
  BasesPropertyId,
  DateValue,
  LinkValue,
  ListValue,
  NullValue,
  setIcon,
  TFile,
  Notice,
  Menu,
  Value,
  Keymap,
  Platform,
} from "obsidian";
import { KanbanView } from "../kanban-view";
import {
  LEGACY_ORDER_PROPERTY,
  ORDER_PROPERTY,
  sanitizeFilename,
} from "../support/constants";
import { relativeLuminance } from "../support/color-utils";

const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

// Format a Value for chip display:
//   - DateValue    → relative ("3 days ago")
//   - LinkValue    → alias if set, otherwise basename without .md extension
//                    (e.g. [[folder/Mario]] → "Mario", [[Welcome|Alias]] → "Alias")
//   - ListValue    → comma-separated list of the above, applied recursively
//   - everything else → toString() (existing behaviour)
function formatValueForChip(val: Value): string {
  if (val instanceof DateValue) {
    return val.relative();
  }
  if (val instanceof LinkValue) {
    const raw = val.toString();
    const match = raw.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
    if (match) {
      const target = match[1];
      const alias = match[2];
      if (alias) return alias;
      const basename = target.split("/").pop() ?? target;
      return basename.replace(/\.md$/, "");
    }
    return raw;
  }
  if (val instanceof ListValue) {
    const parts: string[] = [];
    const len = val.length();
    for (let i = 0; i < len; i++) {
      const item = val.get(i);
      if (!item || item instanceof NullValue || !item.isTruthy()) continue;
      parts.push(formatValueForChip(item));
    }
    return parts.join(", ");
  }
  return val.toString();
}

// File properties that are redundant (shown as the card title) or are
// complex list types that don't render usefully as a short chip value.
const FILE_PROPS_TO_SKIP = new Set([
  "name",
  "basename",
  "fullname",
  "ext",
  "extension",
  "path",
  "links",
  "backlinks",
  "inlinks",
  "outlinks",
  "embeds",
  "tags",
]);
const ORDER_PROPS_TO_SKIP = new Set([ORDER_PROPERTY, LEGACY_ORDER_PROPERTY]);

export class CardManager {
  private view: KanbanView;

  constructor(view: KanbanView) {
    this.view = view;
  }

  public renderCard(
    cardsEl: HTMLElement,
    entry: BasesEntry,
    columnName: string,
    existingCardEl?: HTMLElement | null,
  ): void {
    const filePath = entry.file?.path ?? "";
    const cardEl = existingCardEl ?? cardsEl.createDiv({ cls: "kanbase-card" });
    const renderVersion = this.getRenderVersion(entry);
    cardEl.style.setProperty(
      "--kanbase-card-title-font-size",
      `${this.view.plugin.getCardTitleFontSize()}px`,
    );

    if (existingCardEl) {
      cardsEl.appendChild(cardEl);
      cardEl.dataset.columnName = columnName;
      cardEl.removeClass("kanbase-card--dragging");
      cardEl.removeClass("kanbase-card--drag-ghost");
      cardEl.removeClass("kanbase-card--selected");
      if (cardEl.dataset.renderVersion === renderVersion) return;
      cardEl.innerHTML = "";
    } else {
      cardEl.setAttr("draggable", "true");
      cardEl.dataset.filePath = filePath;
      cardEl.dataset.columnName = columnName;
    }
    cardEl.dataset.renderVersion = renderVersion;

    const file = this.view.app.vault.getAbstractFileByPath(filePath);
    const coverProp = this.view.boardConfig.getCardCoverProperty();
    if (file instanceof TFile && coverProp) {
      const src = this.getCardCoverSrc(file, coverProp);
      if (src) {
        this.renderCardThumbnail(cardEl, src);
      }
    }

    if (!existingCardEl) {
      // Open the note on click; guard against accidental clicks after a drag
      let dragEndTime = 0;
      cardEl.addEventListener("dragend", () => {
        dragEndTime = Date.now();
      });

      cardEl.addEventListener("click", (e: MouseEvent) => {
        if (Date.now() - dragEndTime < 100) return;

        const isAlt = e.altKey;
        const isShift = e.shiftKey;
        const isMod = e.ctrlKey || e.metaKey;

        if ((isAlt || isShift) && !isMod) {
          e.preventDefault();
          this.view.cardSelection.select(
            filePath,
            cardEl.dataset.columnName ?? columnName,
            isShift,
          );
          return;
        }

        // If there are selected cards, clear them on a plain click instead of opening
        if (this.view.cardSelection.hasSelection()) {
          this.view.cardSelection.clear();
          return;
        }

        const file = this.view.navigation.resolveFile(filePath);
        if (!file) return;

        // Handle standard Obsidian modifiers using Keymap.isModEvent(e)
        const mod = Keymap.isModEvent(e);
        if (mod) {
          e.preventDefault();
          void this.view.app.workspace.getLeaf(mod).openFile(file);
          return;
        }

        this.view.navigation.open(file);
      });

      // Middle-click → always open in new tab
      cardEl.addEventListener("auxclick", (e: MouseEvent) => {
        if (e.button !== 1) return;
        const file = this.view.navigation.resolveFile(filePath);
        if (!file) return;
        this.view.navigation.openInNewTab(file);
      });

      // Keyboard: Escape clears multi-selection when a card is focused
      cardEl.setAttribute("tabindex", "-1");
      cardEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.view.cardSelection.hasSelection()) {
          e.preventDefault();
          this.view.cardSelection.clear();
        }
      });

      // Hover → native Obsidian page-preview popover (same as hovering a [[wikilink]])
      // Use mouseenter (not mouseover) — mouseover bubbles from every child element
      // and would re-trigger the preview on each chip/tag/title crossing.
      cardEl.addEventListener("mouseenter", (evt: MouseEvent) => {
        if (!filePath || !this.view.plugin.isHoverPreviewEnabled()) return;
        this.view.app.workspace.trigger("hover-link", {
          event: evt,
          source: "kanbase",
          hoverParent: this.view,
          targetEl: cardEl,
          linktext: filePath,
        });
      });

      // Right-click → batch move menu when cards are selected, otherwise standard file menu
      cardEl.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();
        if (Platform.isMobile) return;
        const file = this.view.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return;

        // If this card is part of a multi-selection, show the batch move menu
        if (this.view.cardSelection.isMultiSelectionContaining(filePath)) {
          this.view.cardSelection.showMoveMenu(e);
          return;
        }

        const menu = new Menu();
        this.view.app.workspace.trigger(
          "file-menu",
          menu,
          file,
          "kanbase-card",
          this.view.app.workspace.getMostRecentLeaf(),
        );
        menu.showAtMouseEvent(e);
      });
    }

    const tagPosition = this.view.plugin.getCardTagPosition();
    if (file instanceof TFile && tagPosition === "top") {
      this.renderCardTags(cardEl, file, tagPosition);
    }

    const titleEl = cardEl.createDiv({ cls: "kanbase-card-title" });

    // Respect cardTitleProperty if configured — use a frontmatter property
    // (e.g. "title") as the card heading instead of the filename.
    let cardTitle = entry.file?.basename ?? "Untitled";
    const titleProp = this.view.config.get("cardTitleProperty") as
      string | undefined;
    if (titleProp) {
      const propId = titleProp.startsWith("note.")
        ? titleProp
        : `note.${titleProp}`;
      const tv = entry.getValue(propId as BasesPropertyId);
      if (tv && !(tv instanceof NullValue) && tv.isTruthy()) {
        cardTitle = formatValueForChip(tv);
      }
    }
    titleEl.createSpan({ text: cardTitle });

    // ---- Edit button (visible on hover) ----
    const editBtn = cardEl.createDiv({ cls: "kanbase-card-edit-btn" });
    setIcon(editBtn, "lucide-pencil");
    editBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation(); // Don't open the note
      this.showCardActionMenu(editBtn, filePath, titleEl);
    });

    // ---- Property chips ----
    const propsEl = cardEl.createDiv({ cls: "kanbase-card-props" });
    const groupByProp = this.view.boardConfig.getGroupByProperty();
    const visibleProps: BasesPropertyId[] = this.view.config.getOrder();

    // Collect eligible chip descriptors in one pass so filtering logic lives
    // in one place.  No DOM is created yet.
    interface ChipDescriptor {
      propId: string;
      displayName: string;
      display: string;
      val: Value;
    }

    const chips: ChipDescriptor[] = [];
    for (const propId of visibleProps) {
      if (chips.length >= 6) break;
      if (propId.startsWith("file.")) {
        if (FILE_PROPS_TO_SKIP.has(propId.slice(5))) continue;
      }
      const propName = propId.startsWith("note.") ? propId.slice(5) : propId;
      if (groupByProp && propName === groupByProp) continue;
      if (ORDER_PROPS_TO_SKIP.has(propName)) continue;

      const val = entry.getValue(propId);
      if (!val || val instanceof NullValue || !val.isTruthy()) continue;
      const display = formatValueForChip(val);
      if (!display) continue;

      chips.push({
        propId,
        displayName: this.view.config.getDisplayName(propId),
        display,
        val,
      });
    }

    const CHIP_VISIBLE = 4;

    // Render visible chips.
    for (let i = 0; i < chips.length && i < CHIP_VISIBLE; i++) {
      const { displayName, display, propId, val } = chips[i];
      this.renderChip(propsEl, displayName, display, propId, val);
    }

    // Overflow chips (if any) go into a collapsible container.
    let overflowEl: HTMLDivElement | null = null;
    for (let i = CHIP_VISIBLE; i < chips.length; i++) {
      if (!overflowEl) {
        overflowEl = propsEl.createDiv({
          cls: "kanbase-card-chips-overflow",
        });
      }
      const { displayName, display, propId, val } = chips[i];
      this.renderChip(overflowEl, displayName, display, propId, val);
    }

    // ---- Expand toggle when chips exceed visible threshold ----
    if (overflowEl) {
      const overflowCount = chips.length - CHIP_VISIBLE;
      const toggleBtn = propsEl.createSpan({
        cls: "kanbase-card-chip-more",
      });
      toggleBtn.setText(`+${overflowCount} more`);
      toggleBtn.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();
        const expanded = overflowEl.classList.toggle(
          "kanbase-card-chips-overflow--expanded",
        );
        toggleBtn.setText(expanded ? "show less" : `+${overflowCount} more`);
      });
    }

    if (file instanceof TFile && tagPosition === "bottom") {
      this.renderCardTags(cardEl, file, tagPosition);
    }
  }

  private renderCardTags(
    cardEl: HTMLElement,
    file: TFile,
    position: "top" | "bottom",
  ): void {
    const fileTags = this.view.tags.getTagsForCardDisplay(file);
    if (fileTags.length === 0) return;

    const tagContainerEl = cardEl.createDiv({
      cls: ["kanbase-tag-container", `kanbase-tag-container--${position}`],
    });
    for (const tag of fileTags) {
      const tagEl = tagContainerEl.createSpan({
        cls: "kanbase-card-tag",
        text: tag,
      });
      const color = this.view.tags.getColorForTag(tag);
      if (color) {
        tagEl.style.setProperty("--tag-color", color);
        if (relativeLuminance(color) === "dark") {
          tagEl.addClass("kanbase-card-tag-light");
        } else {
          tagEl.addClass("kanbase-card-tag-dark");
        }
      }
    }
  }

  private getRenderVersion(entry: BasesEntry): string {
    const file = entry.file;
    const groupByProp = this.view.boardConfig.getGroupByProperty();
    const visibleProperties = this.view.config
      .getOrder()
      .filter((propId) => {
        const propName = propId.startsWith("note.") ? propId.slice(5) : propId;
        return propName !== groupByProp && !ORDER_PROPS_TO_SKIP.has(propName);
      })
      .map((propId) => {
        const value = entry.getValue(propId);
        return [
          propId,
          this.view.config.getDisplayName(propId),
          value && !(value instanceof NullValue) && value.isTruthy()
            ? formatValueForChip(value)
            : "",
        ];
      });
    const resolvedFile = file
      ? this.view.app.vault.getAbstractFileByPath(file.path)
      : null;
    const tags =
      resolvedFile instanceof TFile
        ? this.view.tags.getTagsForCardDisplay(resolvedFile)
        : [];
    const coverProperty = this.view.boardConfig.getCardCoverProperty();
    const cover =
      resolvedFile instanceof TFile && coverProperty
        ? this.getCardCoverSrc(resolvedFile, coverProperty)
        : null;
    const titleProperty = this.view.config.get("cardTitleProperty");
    const titleValue =
      typeof titleProperty === "string"
        ? entry.getValue(
            (titleProperty.startsWith("note.")
              ? titleProperty
              : `note.${titleProperty}`) as BasesPropertyId,
          )
        : null;

    return JSON.stringify({
      path: file?.path ?? "",
      basename: file?.basename ?? "",
      cover,
      title:
        titleValue &&
        !(titleValue instanceof NullValue) &&
        titleValue.isTruthy()
          ? formatValueForChip(titleValue)
          : (file?.basename ?? "Untitled"),
      visibleProperties,
      tags,
      tagColors: this.view.tags.getColors(),
      tagPosition: this.view.plugin.getCardTagPosition(),
      titleFontSize: this.view.plugin.getCardTitleFontSize(),
    });
  }

  /** Create a single chip span with label + value inside the given parent. */
  private renderChip(
    parent: HTMLElement,
    label: string,
    value: string,
    propId?: string,
    val?: Value,
  ): HTMLElement {
    const chip = parent.createSpan({ cls: "kanbase-card-chip" });
    if (propId) chip.setAttr("data-property-id", propId);
    chip.createSpan({ text: label, cls: "kanbase-chip-label" });
    const valueEl = chip.createSpan({ cls: "kanbase-chip-value" });
    // Formula properties (e.g. one using html()) resolve to a value whose
    // toString() is raw markup. Render formula output through the Bases
    // renderer so HTML is shown as rich content instead of being escaped to
    // literal text by setText().
    if (val && propId?.startsWith("formula.")) {
      valueEl.addClass("kanbase-chip-value--formula");
      val.renderTo(valueEl, this.view.app.renderContext);
    } else {
      valueEl.setText(value);
    }
    return chip;
  }

  private showCardActionMenu(
    anchorEl: HTMLElement,
    filePath: string,
    titleEl: HTMLElement,
  ): void {
    const file = this.view.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) return;

    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("Edit tags")
        .setIcon("lucide-tags")
        .onClick(() => {
          this.view.tags.promptEditTags(file);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Open")
        .setIcon("lucide-file-text")
        .onClick(() => {
          this.view.navigation.open(file);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Open in new tab")
        .setIcon("lucide-file-plus")
        .onClick(() => {
          this.view.navigation.openInNewTab(file);
        });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle("Rename")
        .setIcon("lucide-pencil")
        .onClick(() => {
          this.startCardRename(titleEl, file);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Delete")
        .setIcon("lucide-trash-2")
        .onClick(async () => {
          await this.view.app.fileManager.trashFile(file);
          new Notice(`Moved "${file.basename}" to trash`);
        });
    });

    const rect = anchorEl.getBoundingClientRect();
    menu.showAtPosition({ x: rect.right, y: rect.bottom });
  }

  private startCardRename(titleEl: HTMLElement, file: TFile): void {
    const titleSpan = titleEl.querySelector("span");
    if (!titleSpan) return;

    const input = titleEl.createEl("input");
    input.type = "text";
    input.value = file.basename;
    input.className = "kanbase-card-rename-input";

    titleSpan.remove();
    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const newName = input.value.trim();
      if (newName && newName !== file.basename) {
        const newPath = file.path.replace(
          /[^/]+\.md$/,
          `${sanitizeFilename(newName)}.md`,
        );
        try {
          await this.view.app.fileManager.renameFile(file, newPath);
        } catch (err) {
          new Notice(`Rename failed: ${String(err)}`);
        }
      }
      // Re-render will pick up the new name via onDataUpdated
      this.view.updates.scheduleRender();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        committed = true;
        this.view.updates.scheduleRender();
      }
    });
    input.addEventListener("blur", () => {
      void commit();
    });
  }

  private getCardCoverSrc(file: TFile, coverPropName: string): string | null {
    if (coverPropName === "__proto__" || coverPropName === "constructor") {
      return null;
    }
    const cache = this.view.app.metadataCache.getFileCache(file);
    const rawValue: unknown = cache?.frontmatter?.[coverPropName];
    if (!rawValue) return null;
    if (typeof rawValue !== "string" && typeof rawValue !== "number")
      return null;

    if (typeof rawValue === "string" && /^https?:\/\//i.test(rawValue)) {
      return rawValue;
    }

    const cleanPath = String(rawValue)
      .replace(/^!?\[\[(.*?)\]\]$/, "$1")
      .split("|")[0]
      .split("#")[0]
      .trim();

    if (!cleanPath) return null;

    const resolved = this.view.app.metadataCache.getFirstLinkpathDest(
      cleanPath,
      file.path,
    );

    if (
      resolved instanceof TFile &&
      IMAGE_EXTENSIONS.has(resolved.extension.toLowerCase())
    ) {
      return this.view.app.vault.getResourcePath(resolved);
    }

    return null;
  }

  private renderCardThumbnail(cardEl: HTMLElement, src: string): void {
    const thumbEl = cardEl.createDiv();
    thumbEl.className = "kanbase-card-thumbnail";
    thumbEl
      .createEl("img", {
        cls: "kanbase-card-thumbnail-img",
        attr: { src, loading: "lazy" },
      })
      .addEventListener("error", () => {
        thumbEl.remove();
        cardEl.removeClass("kanbase-card--has-thumbnail");
      });
    cardEl.prepend(thumbEl);
    cardEl.addClass("kanbase-card--has-thumbnail");
  }
}
