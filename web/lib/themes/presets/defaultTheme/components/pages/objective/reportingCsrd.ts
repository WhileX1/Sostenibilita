import type { CSSProperties } from "react";
import {
  BEVEL_DARK,
  BEVEL_HILITE,
  BEVEL_LIGHT,
  BEVEL_SHADOW,
  FONT_SANS,
  SURFACE_PRIMARY,
  SURFACE_WINDOW,
  SYNTAX_SCORE,
  TEXT_ON_PRIMARY,
} from "../../../constants";
import { COLORS } from "../../../../../tokens";

// Reporting CSRD page — read-only "document" view that consumes
// every other slice (metrics, esg materiality) and lays the result
// out as a CSRD-flavoured sustainability statement.
//
// Visual register: still inside the Win2K window shell (consistency
// with the rest of the app), but the body of the document is
// deliberately quieter than the editor pages — fewer bevels, more
// whitespace, body text closer to "paper" than to "control panel".
// The aim is for the user to read it as a *report*, not as a form.
//
// `printable-report` and `no-print` classes are toggled in the
// `@media print` block in `globals.css` so the user can save the
// window as PDF and get just the document, without taskbar / window
// chrome.

const SECTION_TITLE_COLOR = COLORS.gray700;

export const reportingCsrd = {
  page: {
    fontFamily: FONT_SANS,
    color: TEXT_ON_PRIMARY,
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minHeight: "100%",
    padding: "4px 8px",
  } as CSSProperties,

  // Document header — the only place where we use a typographic
  // tone closer to a printed cover page than to OS chrome. Bordered
  // bottom rule mimics report-cover convention.
  docHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingBottom: "10px",
    borderBottom: `2px solid ${TEXT_ON_PRIMARY}`,
  } as CSSProperties,

  docTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "0.01em",
  } as CSSProperties,

  docSubtitle: {
    margin: 0,
    fontSize: "12px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  // Section heading — used for "Executive summary", "Materiality
  // assessment", and the three area headings.
  //
  // `breakAfter: "avoid"` keeps the heading on the same printed page
  // as the content that follows it. Without this, when "Environmental"
  // lands near the bottom of a page the area's first metric block
  // gets pushed to the next page, leaving the heading orphaned at
  // the bottom of the previous page — the classic print regression.
  h2: {
    margin: "0 0 8px 0",
    fontSize: "15px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: SECTION_TITLE_COLOR,
    borderBottom: `1px solid ${BEVEL_SHADOW}`,
    paddingBottom: "2px",
    breakAfter: "avoid",
  } as CSSProperties,

  // Sub-heading inside materiality section — for the "not assessed"
  // sub-list. Smaller than h2, no underline. Same break-after rule:
  // a "Topics not assessed" heading should never sit alone at the
  // bottom of a page, divorced from its table.
  h3: {
    margin: "10px 0 4px 0",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: SECTION_TITLE_COLOR,
    breakAfter: "avoid",
  } as CSSProperties,

  // Tertiary heading inside a metric block — Inputs / Methodology /
  // Components labels. The metric block itself uses `breakInside:
  // avoid` so the whole block tends to stay together; the
  // `breakAfter: avoid` here is belt-and-braces for the rare case
  // where a metric is too tall to fit on a single page and the
  // engine has to split it anyway — at least the inner heading
  // doesn't get separated from its body.
  h4: {
    margin: "10px 0 4px 0",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: SECTION_TITLE_COLOR,
    breakAfter: "avoid",
  } as CSSProperties,

  bodyText: {
    margin: "0 0 8px 0",
    lineHeight: 1.5,
  } as CSSProperties,

  // Executive summary — overall ESG score on the left, area
  // sub-scores on the right. Sunken bevel surface like the formula
  // editor's wrapper, so it reads as "data display" rather than
  // input.
  summary: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  } as CSSProperties,

  summaryGrid: {
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
    padding: "12px 16px",
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1fr) minmax(220px, 1fr)",
    gap: "20px",
    alignItems: "center",
  } as CSSProperties,

  summaryOverall: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  } as CSSProperties,

  summaryOverallLabel: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLORS.gray700,
  } as CSSProperties,

  summaryOverallValue: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "32px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: SYNTAX_SCORE,
    lineHeight: 1,
  } as CSSProperties,

  summaryOverallEmpty: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "22px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  summaryAreaList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  } as CSSProperties,

  summaryAreaItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "16px",
    borderBottom: `1px dotted ${BEVEL_SHADOW}`,
    paddingBottom: "2px",
  } as CSSProperties,

  summaryAreaLabel: {
    fontWeight: 700,
  } as CSSProperties,

  summaryAreaValue: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    color: SYNTAX_SCORE,
  } as CSSProperties,

  // Materiality assessment block — the bridge between Strategy's
  // sliders and the topical sections below. Includes the "topics
  // not assessed" sub-table for honest disclosure of what the report
  // does NOT cover.
  materialityBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  } as CSSProperties,

  materialityTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  } as CSSProperties,

  notAssessedTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  } as CSSProperties,

  // Per-area block — wraps the 3-4 metric sections. Spacing is
  // calibrated for both screen reading and print output.
  areaBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  } as CSSProperties,

  // Per-metric block — the heart of the document. One per scored
  // metric, contains: ESRS title, materiality + rating, narrative,
  // inputs, formula, components.
  //
  // `pageBreakInside` (legacy) and `breakInside` (modern): keep
  // the metric on one printed page when possible — it's a unit of
  // reading and splitting it across pages confuses the eye.
  metricBlock: {
    border: `1px solid ${BEVEL_SHADOW}`,
    background: SURFACE_PRIMARY,
    padding: "10px 14px 12px",
    breakInside: "avoid",
  } as CSSProperties,

  metricHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    marginBottom: "6px",
    // The metric block as a whole has `breakInside: avoid`, but if a
    // particular metric is too tall to fit on one page the engine
    // *will* split it. Keep at least the title+subtitle together
    // with whatever follows so a metric never gets split between
    // its name and its rating row.
    breakAfter: "avoid",
    breakInside: "avoid",
  } as CSSProperties,

  metricTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700,
  } as CSSProperties,

  metricCode: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    fontWeight: 400,
    color: COLORS.gray700,
  } as CSSProperties,

  metricSubtitle: {
    margin: 0,
    fontSize: "11px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  // Rating row — bar + numeric value. Horizontal layout so the bar
  // reads as a "thermometer" with the number as its label.
  metricRatingRow: {
    display: "grid",
    gridTemplateColumns: "1fr 80px",
    alignItems: "center",
    gap: "10px",
    margin: "6px 0",
  } as CSSProperties,

  metricRatingValue: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "14px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: SYNTAX_SCORE,
    textAlign: "right",
  } as CSSProperties,

  metricRatingEmpty: {
    fontFamily: "Consolas, 'Courier New', monospace",
    color: COLORS.gray700,
    fontStyle: "italic",
    textAlign: "right",
  } as CSSProperties,

  metricNarrative: {
    margin: "4px 0 6px 0",
    lineHeight: 1.5,
    fontSize: "12px",
  } as CSSProperties,

  // Inputs as a definition list, paper-style: label + name on the
  // left, value on the right, dotted leader line between them so the
  // eye tracks across the row.
  inputsList: {
    margin: 0,
    fontSize: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  } as CSSProperties,

  inputsRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "baseline",
    gap: "8px",
    borderBottom: `1px dotted ${BEVEL_SHADOW}`,
    padding: "1px 0",
  } as CSSProperties,

  inputsLabel: {
    margin: 0,
  } as CSSProperties,

  inputsName: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "11px",
    color: COLORS.gray700,
  } as CSSProperties,

  inputsValue: {
    margin: 0,
    fontFamily: "Consolas, 'Courier New', monospace",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    textAlign: "right",
  } as CSSProperties,

  // Formula as a code block — sunken white surface inside the
  // primary-coloured metric block, so it visually reads as "this is
  // the source of the math". Same surface treatment as the editor's
  // formula textarea so the user recognises it.
  formulaBlock: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "12px",
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    padding: "6px 8px",
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } as CSSProperties,

  // Components table — each row is one variable referenced in
  // `score = …`. Columns: Component, Direction, Range, Raw,
  // Normalized %, Share %.
  componentsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  } as CSSProperties,

  // Shared cell styles — table headers and body cells. Variants for
  // alignment and mono font (where the content is numeric or an
  // identifier). Kept as separate keys instead of a single
  // composable object so callsites read declaratively.
  thLeft: {
    textAlign: "left",
    fontWeight: 700,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: SECTION_TITLE_COLOR,
    padding: "4px 6px 2px",
    borderBottom: `1px solid ${BEVEL_SHADOW}`,
  } as CSSProperties,

  thRight: {
    textAlign: "right",
    fontWeight: 700,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: SECTION_TITLE_COLOR,
    padding: "4px 6px 2px",
    borderBottom: `1px solid ${BEVEL_SHADOW}`,
  } as CSSProperties,

  tdLeft: {
    padding: "2px 6px",
    borderBottom: `1px dotted ${BEVEL_SHADOW}`,
  } as CSSProperties,

  tdLeftMono: {
    padding: "2px 6px",
    fontFamily: "Consolas, 'Courier New', monospace",
    borderBottom: `1px dotted ${BEVEL_SHADOW}`,
  } as CSSProperties,

  tdLeftItalic: {
    padding: "2px 6px",
    fontStyle: "italic",
    color: COLORS.gray700,
    borderBottom: `1px dotted ${BEVEL_SHADOW}`,
  } as CSSProperties,

  tdRightMono: {
    padding: "2px 6px",
    fontFamily: "Consolas, 'Courier New', monospace",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    borderBottom: `1px dotted ${BEVEL_SHADOW}`,
  } as CSSProperties,

  // Sunken bar wrapper. The fill itself is rendered as an SVG
  // `<rect>` inside the wrapper — see `RatingBar` in
  // `ReportingCsrd.tsx`. SVG fills survive the browser's print
  // ink-saving stripping, so the colour-banded bar prints reliably
  // regardless of the user's "Background graphics" toggle. The
  // wrapper's own bevel via box-shadow is decorative and may or
  // may not survive print — that's acceptable, the bar's
  // information content is the fill.
  bar: {
    position: "relative",
    height: "12px",
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
    overflow: "hidden",
  } as CSSProperties,

  // Footer — disclaimer + print button. Disclaimer set in slightly
  // smaller body text with a top rule to separate it from the last
  // metric block.
  footer: {
    marginTop: "auto",
    paddingTop: "10px",
    borderTop: `1px solid ${BEVEL_SHADOW}`,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  } as CSSProperties,

  disclaimer: {
    margin: 0,
    fontSize: "11px",
    color: COLORS.gray700,
    lineHeight: 1.5,
  } as CSSProperties,

  // Print button — Win2K raised bevel, same as Strategy's reset.
  // The `no-print` class on the element itself hides it during the
  // browser's print stylesheet (rule lives in `globals.css`).
  printButton: {
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
    alignSelf: "flex-start",
  } as CSSProperties,
} as const;
