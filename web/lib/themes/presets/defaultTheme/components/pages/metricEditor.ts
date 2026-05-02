import type { CSSProperties } from "react";
import {
  BEVEL_DARK,
  BEVEL_HILITE,
  BEVEL_LIGHT,
  BEVEL_SHADOW,
  FONT_SANS,
  SURFACE_PRIMARY,
  SURFACE_WINDOW,
  SYNTAX_BOOLEAN,
  SYNTAX_BUILTIN,
  SYNTAX_COMPUTED,
  SYNTAX_INPUT,
  SYNTAX_LITERAL,
  SYNTAX_NUMBER,
  SYNTAX_OPERATOR,
  SYNTAX_PUNCT,
  SYNTAX_SCORE,
  SYNTAX_STRING,
  TEXT_ON_PRIMARY,
} from "../../constants";
import { COLORS } from "../../../../tokens";

// Shared button factory — every Win2K text button on this page uses the
// same bevel + state machine. Kept as a function so the four buttons
// (Aggiungi input / Salva / Annulla / Reset) don't drift apart.
const buttonBase: CSSProperties = {
  appearance: "none",
  background: SURFACE_PRIMARY,
  color: TEXT_ON_PRIMARY,
  fontFamily: "inherit",
  fontSize: "13px",
  paddingTop: "4px",
  paddingRight: "12px",
  paddingBottom: "4px",
  paddingLeft: "12px",
  cursor: "pointer",
  border: "none",
  outline: "none",
  boxShadow: `inset 1px 1px 0 ${BEVEL_LIGHT}, inset 2px 2px 0 ${BEVEL_HILITE}, inset -1px -1px 0 ${BEVEL_DARK}, inset -2px -2px 0 ${BEVEL_SHADOW}`,
  flexShrink: 0,
  userSelect: "none",
};

const buttonPressed: CSSProperties = {
  boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset 2px 2px 0 ${BEVEL_SHADOW}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
  // Mirror padding shift so the label nudges 1px down-right when pressed —
  // the same trick `Strategy`'s reset button uses, kept here for Win2K
  // consistency across pages.
  paddingTop: "5px",
  paddingLeft: "13px",
  paddingRight: "11px",
  paddingBottom: "3px",
};

const buttonHover: CSSProperties = {
  background: BEVEL_HILITE,
};

const buttonFocus: CSSProperties = {
  outline: "1px dotted",
  outlineOffset: "-4px",
};

const sunkenField: CSSProperties = {
  appearance: "none",
  background: SURFACE_WINDOW,
  color: TEXT_ON_PRIMARY,
  fontFamily: "inherit",
  fontSize: "13px",
  padding: "2px 4px",
  border: "none",
  outline: "none",
  // Sunken bevel (inverse of the raised button): Win2K text-input look.
  boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
  // Without these the <input>'s native intrinsic width (driven by the
  // `size` attribute, default ~20 chars ≈ 150px) overflows whatever
  // grid column it sits in, and the field paints over the next column —
  // which is exactly how the × button got covered. Forcing 100% +
  // border-box keeps every field flush inside its cell.
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
};

// Inline ▼ chevron drawn via SVG-as-data-URI so the <select> reads as
// "click me, I'm a dropdown" even though we strip the native chrome via
// `appearance: none`. Stroked with `gray700` to match the bevel
// shadow's value.
const DROPDOWN_CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'><polygon points='0,0 8,0 4,6' fill='%23404040'/></svg>\")";

const dropdownField: CSSProperties = {
  ...sunkenField,
  paddingRight: "20px",
  backgroundImage: DROPDOWN_CHEVRON,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 6px center",
  cursor: "pointer",
};

// Generic metric-editor styles, shared by every scored E/S/G page (Energy
// Consumption, CO₂ Emissions, …). Only the metric id / page title differ
// between pages; the editor chrome (inputs table, formula textarea,
// component sliders, score footer) is the same shape everywhere.
export const metricEditor = {
  page: {
    fontFamily: FONT_SANS,
    color: TEXT_ON_PRIMARY,
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "100%",
  } as CSSProperties,

  header: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  } as CSSProperties,

  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
  } as CSSProperties,

  helper: {
    margin: 0,
  } as CSSProperties,

  // ESRS code + topic line under the page title — small, italic,
  // mono code for the standards reference. Optional: hidden on
  // metrics whose registry entry doesn't carry an `esrs` block.
  esrsTag: {
    margin: 0,
    fontSize: "11px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  // Materiality strip — sits between the page header and the inputs
  // section. Two visual modes:
  //   * material: thin row, just the toggle + label, beige bevel
  //     so it reads as "metadata" rather than as a control to act on
  //   * not material: prominent panel with a callout + reason
  //     textarea, tinted differently so the user sees at a glance
  //     that the metric is in a non-default state
  materialityStripMaterial: {
    border: `1px solid ${BEVEL_SHADOW}`,
    background: SURFACE_PRIMARY,
    padding: "4px 12px 6px",
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  } as CSSProperties,

  materialityStripNotMaterial: {
    border: `1px solid ${BEVEL_DARK}`,
    background: COLORS.gray200,
    padding: "6px 12px 8px",
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  } as CSSProperties,

  materialityLegend: {
    padding: "0 6px",
    fontWeight: 700,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: COLORS.gray700,
  } as CSSProperties,

  materialityToggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontWeight: 700,
  } as CSSProperties,

  materialityNotice: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.5,
  } as CSSProperties,

  // Reason textarea — full Win2K sunken bevel like the input fields,
  // but multi-line. Label sits inline above the textarea so the form
  // reads as one unit.
  materialityReasonLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: COLORS.gray700,
  } as CSSProperties,

  materialityReasonField: {
    appearance: "none",
    background: SURFACE_WINDOW,
    color: TEXT_ON_PRIMARY,
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 400,
    textTransform: "none",
    letterSpacing: "normal",
    padding: "4px 6px",
    border: "none",
    outline: "none",
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
  } as CSSProperties,

  section: {
    border: `1px solid ${BEVEL_DARK}`,
    padding: "6px 12px 8px",
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  } as CSSProperties,

  sectionLegend: {
    padding: "0 6px",
    fontWeight: 700,
  } as CSSProperties,

  // Inputs table column layout. Held as a const so the inputs grid AND
  // the add-input row below stay in lockstep — they share the exact
  // same template, with the add row leaving the Value cell empty and
  // putting an "+" button in the Action cell.
  //
  //   Name   | Type | Label | Value | Action
  //   ───────┼──────┼───────┼───────┼───────
  //   1fr    | 76px | 2fr   | 110px | 32px
  //
  // Type is fixed wide enough for "boolean" + chevron. Value is fixed
  // because the visible content is typically a 4-digit number; a
  // flexible value column made the field three times wider than the
  // text it contained. Action is 32px so the 24×22 × button has a
  // comfortable margin even under browser zoom.
  inputsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(110px, 1fr) 76px minmax(120px, 2fr) 110px 36px",
    columnGap: "10px",
    rowGap: "4px",
    alignItems: "center",
  } as CSSProperties,

  inputsHeaderCell: {
    fontWeight: 700,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    paddingBottom: "2px",
    borderBottom: `1px solid ${BEVEL_SHADOW}`,
  } as CSSProperties,

  // Read-only identifier cell — azure to match input references in the
  // formula. Computed names never appear here (they're not inputs), so
  // the cell only ever needs the input colour.
  inputName: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    color: SYNTAX_INPUT,
  } as CSSProperties,

  // Type cell — base style only (font + size). The colour is applied
  // per-row from the inputType<Number|Boolean|String> overlays below
  // so each type label reads in the same colour as that type's
  // literals would inside the formula.
  inputType: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
  } as CSSProperties,

  inputTypeNumber:  { color: SYNTAX_NUMBER } as CSSProperties,
  inputTypeBoolean: { color: SYNTAX_BOOLEAN } as CSSProperties,
  inputTypeString:  { color: SYNTAX_STRING } as CSSProperties,

  textField: { ...sunkenField } as CSSProperties,

  numberField: {
    ...sunkenField,
    // Tabular-nums kept so digit columns align across rows even though
    // the field is left-aligned. Right-alignment was the spreadsheet
    // default but reads inconsistent next to the string fields, which
    // are necessarily left-aligned.
    fontVariantNumeric: "tabular-nums",
  } as CSSProperties,

  checkbox: {
    // Native checkbox at default size (~13px) is hard to hit, especially
    // for touch users. Bumping to 18px keeps the OS rendering (which is
    // already familiar to the user) but with a more comfortable hit area.
    width: "18px",
    height: "18px",
    margin: 0,
    cursor: "pointer",
  } as CSSProperties,

  // Per-row remove button — small (24×24-ish), all-bevel, "×" glyph.
  removeButton: {
    ...buttonBase,
    paddingTop: "0",
    paddingBottom: "0",
    paddingLeft: "6px",
    paddingRight: "6px",
    fontSize: "14px",
    lineHeight: "20px",
    width: "24px",
    height: "22px",
  } as CSSProperties,
  removeButtonHover: buttonHover,
  removeButtonFocus: buttonFocus,
  removeButtonPressed: {
    ...buttonPressed,
    paddingTop: "1px",
    paddingLeft: "7px",
    paddingRight: "5px",
    paddingBottom: "-1px",
  } as CSSProperties,

  // Same 5-column grid as the inputs table above so the new-input
  // form's name/type/label fields line up with their existing
  // counterparts. The Value column is intentionally left empty (you
  // assign the value after the input exists), and the Action column
  // hosts the "+" Add button — symmetric with the "×" Remove button on
  // the populated rows.
  addInputRow: {
    display: "grid",
    gridTemplateColumns: "minmax(110px, 1fr) 76px minmax(120px, 2fr) 110px 36px",
    columnGap: "10px",
    rowGap: "4px",
    alignItems: "center",
    marginTop: "6px",
    paddingTop: "6px",
    borderTop: `1px solid ${BEVEL_SHADOW}`,
  } as CSSProperties,

  addInputName: { ...sunkenField, minWidth: 0 } as CSSProperties,
  addInputType: { ...dropdownField, minWidth: 0 } as CSSProperties,
  addInputLabel: { ...sunkenField, minWidth: 0 } as CSSProperties,

  // Add-row validation error — rendered in the Value cell of the add
  // row. Sits exactly where the future input's value will live, so the
  // user reads "this is what's wrong before you can fill in a value
  // here". Wraps inside the 110px cell when the message is long; the
  // row's height expands to fit.
  addInputError: {
    color: COLORS.syntaxScore,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.2,
    margin: 0,
    whiteSpace: "normal",
    wordBreak: "break-word",
    alignSelf: "center",
  } as CSSProperties,

  // Larger button used for "Aggiungi input" / "Salva" / "Annulla" / "Reset"
  primaryButton: buttonBase,
  primaryButtonHover: buttonHover,
  primaryButtonFocus: buttonFocus,
  primaryButtonPressed: buttonPressed,

  // The editor is a three-layer stack:
  //   1. wrapper — owns the white background and the sunken bevel
  //   2. overlay — coloured spans (transparent bg, no pointer events)
  //   3. textarea — transparent fill so the overlay shows through, with
  //      the real caret and selection painted on top
  //
  // Critical: the textarea CANNOT have an opaque background, otherwise
  // it covers the overlay (the white-on-white bug). The visual surface
  // lives on the wrapper.
  formulaWrapper: {
    position: "relative",
    width: "100%",
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
  } as CSSProperties,

  formulaOverlay: {
    position: "absolute",
    inset: 0,
    margin: 0,
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "13px",
    lineHeight: 1.5,
    padding: "6px 8px",
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "hidden",
    color: TEXT_ON_PRIMARY,
    pointerEvents: "none",
    background: "transparent",
  } as CSSProperties,

  formulaTextarea: {
    appearance: "none",
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "13px",
    minHeight: "180px",
    padding: "6px 8px",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
    lineHeight: 1.5,
    border: "none",
    outline: "none",
    // Both fill colour and background must be transparent so the
    // overlay's coloured spans on the wrapper's white surface show
    // through. The caret stays black via `caretColor`.
    color: "transparent",
    caretColor: TEXT_ON_PRIMARY,
    background: "transparent",
    // Stack above the overlay so caret + native selection paint on top
    // of the coloured spans.
    position: "relative",
    zIndex: 1,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    display: "block",
  } as CSSProperties,

  // Per-kind syntax colour. Operators / keywords / built-ins share
  // pink so the language structure reads as one visual class. Input
  // identifiers (external data) are azure; computed identifiers
  // (derived in the formula) are violet — the visual distinction tells
  // the user "this came from outside" vs "I made this up here".
  // `score` gets its own red to flag the formula's exit point at a
  // glance. Boolean literals (TRUE/FALSE) get teal so they match the
  // "boolean" type label in the inputs table — same rule as numbers
  // (green) and strings (orange).
  syntaxOperator: { color: SYNTAX_OPERATOR } as CSSProperties,
  syntaxBuiltin:  { color: SYNTAX_BUILTIN } as CSSProperties,
  syntaxLiteral:  { color: SYNTAX_LITERAL } as CSSProperties,
  syntaxNumber:   { color: SYNTAX_NUMBER } as CSSProperties,
  syntaxString:   { color: SYNTAX_STRING } as CSSProperties,
  syntaxInput:    { color: SYNTAX_INPUT } as CSSProperties,
  syntaxComputed: { color: SYNTAX_COMPUTED } as CSSProperties,
  syntaxScore:    { color: SYNTAX_SCORE, fontWeight: 700 } as CSSProperties,
  syntaxUnknown:  { color: COLORS.gray500, fontStyle: "italic" } as CSSProperties,
  syntaxPunct:    { color: SYNTAX_PUNCT } as CSSProperties,
  syntaxPlain:    {} as CSSProperties,

  // Small swatch + label legend printed under the editor so the user
  // doesn't have to guess what the colours mean. Inline so it folds
  // gracefully in narrow windows.
  syntaxLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    fontSize: "11px",
    color: COLORS.gray700,
  } as CSSProperties,

  syntaxLegendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  } as CSSProperties,

  syntaxLegendSwatch: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    fontWeight: 700,
  } as CSSProperties,

  // Section legend has the title on the left and an optional help-toggle
  // on the right. Set on the <legend> element via inline-flex so the
  // toggle stays inline with the title rather than wrapping below.
  sectionLegendRow: {
    padding: "0 6px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  } as CSSProperties,

  // Round "?" toggle for the inline help panel. Shares the bevel
  // vocabulary with the row remove button so the page has a consistent
  // small-button shape.
  helpToggle: {
    appearance: "none",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 700,
    width: "20px",
    height: "20px",
    border: "none",
    outline: "none",
    cursor: "pointer",
    boxShadow: `inset 1px 1px 0 ${BEVEL_LIGHT}, inset 2px 2px 0 ${BEVEL_HILITE}, inset -1px -1px 0 ${BEVEL_DARK}, inset -2px -2px 0 ${BEVEL_SHADOW}`,
    userSelect: "none",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as CSSProperties,

  helpToggleHover: { background: BEVEL_HILITE } as CSSProperties,
  helpToggleFocus: {
    outline: "1px dotted",
    outlineOffset: "-3px",
  } as CSSProperties,
  helpTogglePressed: {
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset 2px 2px 0 ${BEVEL_SHADOW}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
  } as CSSProperties,

  // Help panel — Win2K group of static reference text inside the
  // section. Tinted gray + sunken bevel set it apart from the form
  // fields without using strong colour.
  helpPanel: {
    background: COLORS.gray200,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    padding: "8px 12px",
    fontSize: "12px",
    lineHeight: 1.5,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  } as CSSProperties,

  helpPanelTitle: {
    fontWeight: 700,
    fontSize: "11px",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  } as CSSProperties,

  helpPanelDl: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "minmax(110px, max-content) 1fr",
    columnGap: "10px",
    rowGap: "4px",
    alignItems: "baseline",
  } as CSSProperties,

  helpPanelTerm: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontWeight: 700,
    color: TEXT_ON_PRIMARY,
  } as CSSProperties,

  helpPanelDef: {
    margin: 0,
  } as CSSProperties,

  helpPanelCode: {
    fontFamily: "Consolas, 'Courier New', monospace",
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    padding: "6px 8px",
    whiteSpace: "pre",
    overflowX: "auto",
    margin: 0,
  } as CSSProperties,

  // Compile / runtime error — surfaced inline directly under the formula
  // so the user reads it without leaving the editor's visual area. Red
  // for visual urgency, no boxed background so it doesn't compete with
  // the formula textarea above it.
  formulaError: {
    margin: 0,
    color: COLORS.syntaxScore,
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    fontWeight: 700,
    padding: "2px 0",
    whiteSpace: "pre-wrap",
  } as CSSProperties,

  // Component-weights section — appears under the formula whenever the
  // user's `score = …` references one or more variables. Each variable
  // gets a Strategy-style slider whose normalized share contributes to
  // the metric's rating, plus a [min, max] judgement range that maps
  // the variable's native scale onto 0..100 before the weighted average.
  // Reuses Strategy's win2k-slider class (in globals.css) for the slider
  // chrome itself; only the row layout is local.
  //
  // Columns:
  //   Component name (with sign prefix for `-` direction)
  //   Weight slider
  //   Raw weight (n / MAX)
  //   "[min] - [max]" range editor
  //   Share %
  weightsRow: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) 1.6fr 60px 150px 56px",
    alignItems: "center",
    gap: "10px",
    padding: "3px 0",
  } as CSSProperties,

  // Variable name on the left of each slider row. Coloured per the
  // identifier's role — input vs computed — so the user's eye links it
  // back to the same identifier in the formula above.
  weightsLabelInput: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    color: SYNTAX_INPUT,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  weightsLabelComputed: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    color: SYNTAX_COMPUTED,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  // Sign prefix when the variable is subtracted in the formula
  // (`score = a - c`). Painted in the same red as the formula's
  // operator colour so the user's eye links it back to the `-`
  // they wrote. Drawn before the variable name, separated by a thin
  // hair space so it reads as a unit.
  weightsSignNegative: {
    color: SYNTAX_OPERATOR,
    fontWeight: 700,
    marginRight: "2px",
  } as CSSProperties,

  weightsRaw: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  } as CSSProperties,

  weightsShare: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  } as CSSProperties,

  // Inline [min] – [max] editor. Two narrow number fields with a dash
  // between them. The fields share `sunkenField` styling but are
  // smaller (50px wide) so two fit in the column without overflow.
  rangeEditor: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
  } as CSSProperties,

  rangeField: {
    ...sunkenField,
    width: "60px",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    fontSize: "12px",
    padding: "1px 4px",
  } as CSSProperties,

  rangeDash: {
    color: COLORS.gray700,
    userSelect: "none",
  } as CSSProperties,

  weightsHelper: {
    margin: 0,
    fontSize: "11px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  // Score footer — single rating line with the reset button pinned to
  // the right. The rating is the slider-weighted, range-normalized
  // average of the components referenced in `score = …`, clamped to
  // 0..100. One number, one notation, no ambiguity.
  scorePanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    paddingTop: "10px",
    borderTop: `1px solid ${BEVEL_SHADOW}`,
    marginTop: "auto",
    flexWrap: "wrap",
  } as CSSProperties,

  scoreInline: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: "10px",
    minWidth: 0,
  } as CSSProperties,

  scoreLabel: {
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: COLORS.gray700,
  } as CSSProperties,

  scoreValue: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "22px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: SYNTAX_SCORE,
  } as CSSProperties,

  scoreError: {
    fontSize: "13px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  // Live variable preview chips ("renewable_share = 50", "kwh_total = 800")
  // shown under the formula. Inputs and computed variables share this
  // strip so the user sees the whole scope in one place; the chip's
  // colour identifies which is which (azure = input, violet = computed),
  // matching the same per-kind palette the formula editor uses.
  scopeList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    fontSize: "11px",
  } as CSSProperties,

  scopeChipInput: {
    fontFamily: "Consolas, 'Courier New', monospace",
    background: COLORS.gray200,
    border: `1px solid ${BEVEL_SHADOW}`,
    padding: "1px 6px",
    color: SYNTAX_INPUT,
  } as CSSProperties,

  scopeChipComputed: {
    fontFamily: "Consolas, 'Courier New', monospace",
    background: COLORS.gray200,
    border: `1px solid ${BEVEL_SHADOW}`,
    padding: "1px 6px",
    color: SYNTAX_COMPUTED,
  } as CSSProperties,
} as const;
