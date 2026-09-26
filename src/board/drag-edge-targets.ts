/**
 * Temporary "move to top / move to bottom" drop targets shown while a card is
 * dragged over a scrollable column, so the user doesn't have to scroll a long
 * column to reach either end.
 *
 * They are inserted as siblings of the cards container (never as overlays on
 * top of it) so they sit outside the scroll viewport and don't compete with
 * the drag auto-scroll edge zones.
 */

/** Scroll distances below this are treated as "already at the edge". */
const SCROLL_EPSILON = 2;
/** Ignore columns that barely overflow — the targets aren't worth the space. */
const MIN_OVERFLOW = 24;

export type EdgePosition = "top" | "bottom";

export interface EdgeTargetHit {
  cardsEl: HTMLElement;
  position: EdgePosition;
}

interface EdgeTargetEntry {
  columnEl: HTMLElement;
  cardsEl: HTMLElement;
  topEl: HTMLElement;
  bottomEl: HTMLElement;
}

export class DragEdgeTargets {
  private entries: EdgeTargetEntry[] = [];
  private activeEl: HTMLElement | null = null;
  private refreshFrame: number | null = null;

  /** Build one pair of targets per column. Visibility is decided by refresh(). */
  public show(boardEl: HTMLElement | null): void {
    this.hide();
    if (!boardEl) return;

    for (const columnEl of Array.from(
      boardEl.querySelectorAll<HTMLElement>(".kanbase-column"),
    )) {
      const cardsEl = columnEl.querySelector<HTMLElement>(".kanbase-cards");
      if (!cardsEl) continue;
      this.entries.push({
        columnEl,
        cardsEl,
        topEl: this.createTarget(columnEl, cardsEl, "top"),
        bottomEl: this.createTarget(columnEl, cardsEl, "bottom"),
      });
    }

    this.refresh();
  }

  public hide(): void {
    if (this.refreshFrame !== null) {
      window.cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = null;
    }
    for (const entry of this.entries) {
      const hadTopTarget = entry.topEl.classList.contains(
        "kanbase-drop-edge--visible",
      );
      const scrollBefore = entry.cardsEl.scrollTop;
      const heightBefore = entry.cardsEl.clientHeight;
      entry.topEl.remove();
      if (hadTopTarget) {
        entry.cardsEl.scrollTop =
          scrollBefore + (heightBefore - entry.cardsEl.clientHeight);
      }
      entry.bottomEl.remove();
    }
    this.entries = [];
    this.activeEl = null;
  }

  /** Recompute placement/visibility at most once per frame. */
  public scheduleRefresh(): void {
    if (this.entries.length === 0 || this.refreshFrame !== null) return;
    this.refreshFrame = window.requestAnimationFrame(() => {
      this.refreshFrame = null;
      this.refresh();
    });
  }

  public resolve(target: EventTarget | null): EdgeTargetHit | null {
    if (!(target instanceof HTMLElement)) return null;
    const edgeEl = target.closest<HTMLElement>(".kanbase-drop-edge");
    if (!edgeEl) return null;
    const entry = this.entries.find(
      (candidate) =>
        candidate.topEl === edgeEl || candidate.bottomEl === edgeEl,
    );
    if (!entry) return null;
    return {
      cardsEl: entry.cardsEl,
      position: entry.topEl === edgeEl ? "top" : "bottom",
    };
  }

  public setActive(hit: EdgeTargetHit | null): void {
    const nextEl = hit
      ? (this.entries.find((entry) => entry.cardsEl === hit.cardsEl)?.[
          hit.position === "top" ? "topEl" : "bottomEl"
        ] ?? null)
      : null;
    if (nextEl === this.activeEl) return;
    this.activeEl?.removeClass("kanbase-drop-edge--active");
    nextEl?.addClass("kanbase-drop-edge--active");
    this.activeEl = nextEl;
  }

  private createTarget(
    columnEl: HTMLElement,
    cardsEl: HTMLElement,
    position: EdgePosition,
  ): HTMLElement {
    const el = columnEl.createDiv({
      cls: `kanbase-drop-edge kanbase-drop-edge--${position}`,
    });
    el.createSpan({
      cls: "kanbase-drop-edge-label",
      text: position === "top" ? "Move to top" : "Move to bottom",
    });
    columnEl.insertBefore(
      el,
      position === "top" ? cardsEl : cardsEl.nextSibling,
    );
    return el;
  }

  private refresh(): void {
    for (const entry of this.entries) {
      const { cardsEl } = entry;
      const maxScroll = cardsEl.scrollHeight - cardsEl.clientHeight;
      // offsetParent is null while the column is collapsed (display: none).
      const isScrollable =
        cardsEl.offsetParent !== null && maxScroll > MIN_OVERFLOW;

      this.setTopVisible(
        entry,
        isScrollable && cardsEl.scrollTop > SCROLL_EPSILON,
      );
      this.setVisible(
        entry.bottomEl,
        isScrollable && cardsEl.scrollTop < maxScroll - SCROLL_EPSILON,
      );
    }
  }

  /**
   * The top target shrinks the scroll viewport from above, which would push the
   * cards down. Absorb the height change into scrollTop so they stay put.
   */
  private setTopVisible(entry: EdgeTargetEntry, visible: boolean): void {
    const isVisible = entry.topEl.classList.contains(
      "kanbase-drop-edge--visible",
    );
    if (isVisible === visible) return;

    const { cardsEl } = entry;
    const scrollBefore = cardsEl.scrollTop;
    const heightBefore = cardsEl.clientHeight;
    this.setVisible(entry.topEl, visible);
    cardsEl.scrollTop = scrollBefore + (heightBefore - cardsEl.clientHeight);
  }

  private setVisible(el: HTMLElement, visible: boolean): void {
    el.toggleClass("kanbase-drop-edge--visible", visible);
    if (!visible && this.activeEl === el) {
      el.removeClass("kanbase-drop-edge--active");
      this.activeEl = null;
    }
  }
}
