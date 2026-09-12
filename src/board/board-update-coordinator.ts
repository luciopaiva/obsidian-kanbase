export class BoardUpdateCoordinator {
  private isUpdating = false;
  private pendingDataRender = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly acknowledgeData: () => void,
    private readonly render: () => void,
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
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 50);
  }

  public destroy(): void {
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
  }
}
