export const COLORS = {
  // Neutrals
  black:   "#000000",
  white:   "#FFFFFF",
  gray200: "#DFDFDF",
  gray500: "#808080",
  gray700: "#404040",

  // Warm gray (control / window face)
  beige:   "#D4D0C8",

  // Blues
  blue100: "#A6CAF0",
  blue900: "#0A246A",

  // Syntax-highlighting palette — used exclusively inside the formula
  // editor's overlay AND the type/name columns of the inputs table, so
  // a name or type reads with the same colour in both places.
  // Conventions borrowed from common tools: operators pink (SQL),
  // input identifiers azure (Python), strings orange (Python), score
  // red. Computed identifiers + booleans get their own colours so the
  // user can tell external data, derived values, type-flag values, and
  // the final output apart at a glance.
  syntaxOperator: "#C71585", // medium violet red — operators / keywords / builtins
  // Input identifiers (external data). Darkened from the original
  // #0066CC to clear WCAG 2 AA on the gray200 background of the
  // scope chips under the formula editor (was 4.17:1, fails 4.5:1
  // for normal text). The new tone reads ~5.0:1 on gray200 and
  // ~6.7:1 on white — passes everywhere it appears.
  syntaxInput:    "#0058BB", // azure — input identifiers (external data)
  syntaxComputed: "#5C3BA8", // dark violet — computed identifiers (derived values)
  // `score` output. Darkened from the original #C0392B to bring the
  // contrast ratio above WCAG 2 AA (4.5:1 for normal text) on the
  // beige `SURFACE_PRIMARY` background — the metric editor's page,
  // the report's `metricBlock`, the materiality strip's gray200.
  // The original red passed on white but failed on beige (3.55:1);
  // the darker tone passes on every surface in the palette while
  // still reading as the same "score red" semantic family.
  syntaxScore:    "#A02418", // dark red — the conventional `score` output
  // String literals. Darkened from the original #D35400 (4.16:1 on
  // white — fails AA for normal text). New tone reads ~5.6:1 on
  // white, still clearly an orange in the warm-palette sense.
  syntaxString:   "#B04500", // burnt orange — string literals + string type
  syntaxNumber:   "#15803D", // dark green
  syntaxBoolean:  "#0E7C7B", // teal — TRUE / FALSE literals + boolean type
} as const;

export const FONTS = {
  sans: "var(--font-geist-sans)",
} as const;

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
