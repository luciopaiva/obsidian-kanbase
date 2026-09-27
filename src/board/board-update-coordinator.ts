export class BoardUpdateCoordinator {
  private isUpdating = false;
  private pendingDataRender = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly acknowledgeData: () => void,
    private readonly render: () => void,
    private readonly isDragging: () => boolean,
  ) {}

  public onDataUpdated(): void {
    if (this.isUpdating) {
      this.pendingDataRender = true;
      return;
    }
    this.acknowledgeData();
    this.scheduleRender();
  }

  public async applyBatchUpdate(
    updateFn: () => Promise<void> | void,
  ): Promise<void> {
    this.isUpdating = true;
    this.pendingDataRender = false;
    try {
      await updateFn();
    } finally {
      this.isUpdating = false;
    }
    if (this.pendingDataRender) {
      this.pendingDataRender = false;
      this.scheduleRender();
    }
  }

  public scheduleRender(): void {
    // A mid-drag render would wipe the placeholder/dragged element and orphan drag state.
    if (this.isDragging()) {
      this.pendingDataRender = true;
      return;
    }
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      if (this.isDragging()) {
        this.pendingDataRender = true;
        return;
      }
      this.render();
    }, 50);
  }

  /** Flush any render that was deferred while a drag was in progress. */
  public notifyDragEnded(): void {
    if (this.pendingDataRender) {
      this.pendingDataRender = false;
      this.scheduleRender();
    }
  }

  public destroy(): void {
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
  }
}
