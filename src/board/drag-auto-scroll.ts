const HORIZONTAL_ZONE = 80;
const VERTICAL_ZONE = 60;
const MAX_SPEED = 12;

export class DragAutoScroller {
  private animationFrame: number | null = null;
  private horizontalSpeed = 0;
  private verticalSpeed = 0;
  private horizontalEl: HTMLElement | null = null;
  private verticalEl: HTMLElement | null = null;

  public update(
    boardEl: HTMLElement | null,
    clientX: number,
    clientY: number,
    target: HTMLElement,
  ): void {
    this.horizontalEl = boardEl;
    this.horizontalSpeed = boardEl
      ? this.getEdgeSpeed(clientX, boardEl.getBoundingClientRect(), "x")
      : 0;

    const cardsEl = target.closest<HTMLElement>(".kanbase-cards");
    this.verticalEl = cardsEl;
    this.verticalSpeed = cardsEl
      ? this.getEdgeSpeed(clientY, cardsEl.getBoundingClientRect(), "y")
      : 0;

    if (this.horizontalSpeed !== 0 || this.verticalSpeed !== 0) {
      this.start();
    } else {
      this.cancelFrame();
    }
  }

  public stop(): void {
    this.cancelFrame();
    this.horizontalSpeed = 0;
    this.verticalSpeed = 0;
    this.horizontalEl = null;
    this.verticalEl = null;
  }

  private getEdgeSpeed(
    pointerPosition: number,
    rect: DOMRect,
    axis: "x" | "y",
  ): number {
    const start = axis === "x" ? rect.left : rect.top;
    const size = axis === "x" ? rect.width : rect.height;
    const zone = axis === "x" ? HORIZONTAL_ZONE : VERTICAL_ZONE;
    const relativePosition = pointerPosition - start;

    if (relativePosition < zone) {
      return -MAX_SPEED * (1 - relativePosition / zone);
    }
    if (relativePosition > size - zone) {
      return MAX_SPEED * (1 - (size - relativePosition) / zone);
    }
    return 0;
  }

  private start(): void {
    if (this.animationFrame !== null) return;

    const tick = () => {
      if (this.horizontalSpeed === 0 && this.verticalSpeed === 0) {
        this.animationFrame = null;
        return;
      }
      if (this.horizontalEl && this.horizontalSpeed !== 0) {
        this.horizontalEl.scrollLeft += this.horizontalSpeed;
      }
      if (this.verticalEl && this.verticalSpeed !== 0) {
        this.verticalEl.scrollTop += this.verticalSpeed;
      }
      this.animationFrame = window.requestAnimationFrame(tick);
    };

    this.animationFrame = window.requestAnimationFrame(tick);
  }

  private cancelFrame(): void {
    if (this.animationFrame === null) return;
    window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }
}
