import type { App, BasesViewConfig, TFile } from "obsidian";

const LEGACY_VIEW_TYPE = "kanban";
const KANBASE_VIEW_TYPE = "kanbase";

export const MIGRATABLE_KEYS = [
  "cardOpenBehavior",
  "cardCoverProperty",
  "newCardsToTop",
  "boardColumns",
  "columnColors",
  "wipLimits",
  "collapsedColumns",
  "tagFiltersVisible",
  "tagColors",
] as const;

type UnknownRecord = Record<string, unknown>;
type ViewConfig = Pick<BasesViewConfig, "name" | "set">;
type YamlParser = (source: string) => unknown;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => typeof value[key] === "string")
  );
}

function isBooleanMap(value: unknown): value is Record<string, boolean> {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => typeof value[key] === "boolean")
  );
}

function isPositiveNumberMap(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.keys(value).every(
      (key) =>
        typeof value[key] === "number" &&
        Number.isFinite(value[key]) &&
        value[key] > 0,
    )
  );
}

function isValidSetting(key: string, value: unknown): boolean {
  switch (key) {
    case "cardOpenBehavior":
      return (
        value === "active" ||
        value === "modal" ||
        value === "split" ||
        value === "tab"
      );
    case "cardCoverProperty":
      return value === null || typeof value === "string";
    case "newCardsToTop":
    case "tagFiltersVisible":
      return typeof value === "boolean";
    case "boardColumns":
      return (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      );
    case "columnColors":
    case "tagColors":
      return isStringMap(value);
    case "wipLimits":
      return isPositiveNumberMap(value);
    case "collapsedColumns":
      return isBooleanMap(value);
    default:
      return false;
  }
}

function normalizedName(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function selectViewByType(
  views: unknown,
  viewType: string,
  viewName: string,
): UnknownRecord | null {
  if (!Array.isArray(views)) return null;

  const candidates = views.filter(
    (view): view is UnknownRecord => isRecord(view) && view.type === viewType,
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const target = normalizedName(viewName);
  if (!target) return null;
  const matches = candidates.filter(
    (view) => normalizedName(view.name) === target,
  );
  return matches.length === 1 ? matches[0] : null;
}

/** Select one old view, or null when the source is missing or ambiguous. */
export function selectLegacyView(
  views: unknown,
  currentViewName: string,
): UnknownRecord | null {
  return selectViewByType(views, LEGACY_VIEW_TYPE, currentViewName);
}

/** Select the raw Kanbase view whose runtime config triggered migration. */
export function selectKanbaseView(
  views: unknown,
  currentViewName: string,
): UnknownRecord | null {
  return selectViewByType(views, KANBASE_VIEW_TYPE, currentViewName);
}

/** Extract and validate only settings supported by Kanbase. */
export function readMigratableSettings(view: unknown): UnknownRecord | null {
  if (!isRecord(view)) return null;

  const settings: UnknownRecord = {};
  for (const key of MIGRATABLE_KEYS) {
    if (!(key in view)) continue;
    const value = view[key];
    if (!isValidSetting(key, value)) return null;
    settings[key] = value;
  }
  return Object.keys(settings).length > 0 ? settings : null;
}

export function hasStoredKanbaseSettings(view: unknown): boolean {
  return (
    isRecord(view) &&
    MIGRATABLE_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(view, key),
    )
  );
}

function findContainingBaseFile(app: App, scrollEl: HTMLElement): TFile | null {
  let match: TFile | null = null;
  let matchCount = 0;

  app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view as { containerEl?: HTMLElement; file?: TFile };
    if (
      view.containerEl?.contains(scrollEl) &&
      view.file?.extension === "base"
    ) {
      match = view.file;
      matchCount += 1;
    }
  });

  return matchCount === 1 ? match : null;
}

/**
 * Best-effort, per-base migration. Every failure intentionally becomes a no-op.
 * The old YAML view is never edited; config.set updates only the new view.
 */
export async function migrateLegacyViewSettings(
  app: App,
  scrollEl: HTMLElement,
  config: ViewConfig,
  parseYaml: YamlParser,
): Promise<void> {
  try {
    const baseFile = findContainingBaseFile(app, scrollEl);
    if (!baseFile) return;

    const parsed = parseYaml(await app.vault.read(baseFile));
    if (!isRecord(parsed)) return;

    const kanbaseView = selectKanbaseView(parsed.views, config.name);
    if (!kanbaseView || hasStoredKanbaseSettings(kanbaseView)) return;

    const legacyView = selectLegacyView(parsed.views, config.name);
    const settings = readMigratableSettings(legacyView);
    if (!settings) return;

    for (const key of MIGRATABLE_KEYS) {
      if (key in settings) config.set(key, settings[key]);
    }
  } catch {
    // Migration is a non-essential convenience. Malformed legacy data is ignored.
  }
}
