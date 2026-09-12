export const KANBASE_ICON_ID = "kanbase-logo";

/**
 * Compact, monochrome adaptation of the Kanbase logo for Obsidian's icon
 * registry. The three bars preserve the logo silhouette while currentColor
 * lets Obsidian style the icon for each theme and interaction state.
 */
export const KANBASE_ICON_SVG = `
  <rect x="8" y="8" width="84" height="84" rx="20" fill="none" stroke="currentColor" stroke-width="8" />
  <rect x="24" y="30" width="13" height="42" rx="6.5" fill="currentColor" />
  <rect x="44" y="30" width="13" height="42" rx="6.5" fill="currentColor" />
  <rect x="64" y="30" width="13" height="28" rx="6.5" fill="currentColor" />
`.trim();
