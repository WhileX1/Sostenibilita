import { COLORS, FONTS } from "../../tokens";

// 3D bevel colors (raised edge: light → highlight → shadow → dark).
// These describe the *geometry* of a bevel (lit/shaded edges), not a global
// brightness claim, so they keep light/dark suffixes.
export const BEVEL_LIGHT  = COLORS.white;
export const BEVEL_HILITE = COLORS.gray200;
export const BEVEL_SHADOW = COLORS.gray500;
export const BEVEL_DARK   = COLORS.gray700;

// Surfaces — named by tier (PRIMARY = dominant chrome, SECONDARY = accent strip),
// never by brightness. A future preset may invert which one is dark.
export const SURFACE_PRIMARY   = COLORS.beige;
export const SURFACE_SECONDARY = `linear-gradient(90deg, ${COLORS.blue900} 0%, ${COLORS.blue100} 100%)`;
export const BORDER_SECONDARY  = BEVEL_DARK;

// Window body — the inside of an open window. White is the Win2K standard
// (document/list/dialog background); kept as its own alias so a future preset
// can deviate without searching for hex literals.
export const SURFACE_WINDOW   = COLORS.white;

// Default text color for content sitting on each surface.
export const TEXT_ON_PRIMARY   = COLORS.black;
export const TEXT_ON_SECONDARY = COLORS.white;

// Emphasis variants on the primary surface. Both kept fully black for WCAG AAA
// on the current SURFACE_PRIMARY; a future preset is free to introduce a real
// contrast gap. Hierarchy currently comes from font-weight / uppercase.
export const TEXT_ON_PRIMARY_STRONG = COLORS.black;
export const TEXT_ON_PRIMARY_MUTED  = COLORS.black;

// Accent on the primary surface (active / selected item background) and the
// text that goes on top of it.
export const ACCENT_PRIMARY         = COLORS.blue900;
export const TEXT_ON_ACCENT_PRIMARY = COLORS.white;

// Window title bar — active uses the SECONDARY surface gradient (the
// canonical Win2K "active = blue gradient" cue); inactive is a desaturated
// gray gradient. Text always white for max contrast on either gradient.
export const TITLE_BAR_ACTIVE        = SURFACE_SECONDARY;
export const TEXT_ON_TITLE_BAR_ACTIVE = COLORS.white;
export const TITLE_BAR_INACTIVE      = `linear-gradient(90deg, ${COLORS.gray700} 0%, ${COLORS.gray500} 100%)`;
export const TEXT_ON_TITLE_BAR_INACTIVE = COLORS.gray200;

// Start menu side banner — vertical gradient blue→black, classic Win2K.
export const START_MENU_BANNER       = `linear-gradient(180deg, ${COLORS.blue100} 0%, ${COLORS.blue900} 50%, ${COLORS.black} 100%)`;
export const TEXT_ON_START_MENU_BANNER = COLORS.white;

// Typography — Tahoma 8pt was the canonical Win2K UI font
export const FONT_SANS = `Tahoma, "MS Sans Serif", ${FONTS.sans}, sans-serif`;

// Syntax-highlighting palette aliases — consumed by the formula editor
// and by the inputs table's name/type cells (so each name/type reads in
// the same colour wherever it appears). Each kind gets its own alias so
// a future preset can re-skin them without touching components.
export const SYNTAX_OPERATOR = COLORS.syntaxOperator;
export const SYNTAX_BUILTIN  = COLORS.syntaxOperator;
// Boolean literals (TRUE / FALSE) share their colour with the boolean
// type label — same rule as numbers (green literal + green "number"
// type cell) and strings (orange literal + orange "string" type cell).
export const SYNTAX_LITERAL  = COLORS.syntaxBoolean;
export const SYNTAX_INPUT    = COLORS.syntaxInput;
export const SYNTAX_COMPUTED = COLORS.syntaxComputed;
export const SYNTAX_SCORE    = COLORS.syntaxScore;
export const SYNTAX_NUMBER   = COLORS.syntaxNumber;
export const SYNTAX_STRING   = COLORS.syntaxString;
export const SYNTAX_BOOLEAN  = COLORS.syntaxBoolean;
export const SYNTAX_PUNCT    = COLORS.gray500;
