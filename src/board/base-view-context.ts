import { App, TFile, WorkspaceLeaf } from "obsidian";

/** Return whether a workspace leaf is still attached to the workspace. */
export function isLeafAttached(app: App, leaf: WorkspaceLeaf): boolean {
  let found = false;
  app.workspace.iterateAllLeaves((candidate) => {
    if (candidate === leaf) found = true;
  });
  return found;
}

/**
 * Resolve the source .base filename for a directly opened Bases view.
 *
 * This is a workaround: the official Bases API does not expose the source
 * .base file for a custom view, so we have to infer it from the containing
 * workspace leaf and its DOM hierarchy.
 *
 * Embedded Bases inherit the embedding note as `view.file`, so they
 * intentionally return null.
 */
export function getBaseFileName(
  app: App,
  scrollEl: HTMLElement,
): string | null {
  let name: string | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view as { containerEl?: HTMLElement; file?: TFile };
    if (
      view?.containerEl?.contains(scrollEl) &&
      view.file?.extension === "base"
    ) {
      name = view.file.basename;
    }
  });
  return name;
}
