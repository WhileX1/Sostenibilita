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

// Rating ESG page — the aggregator. Shows the overall ESG score
// (materiality-weighted average across every scored metric), then a
// per-area summary, then per-metric rows grouped by area. No editable
// controls of its own — the per-metric editor handles ratings, the
// `Strategy` page handles materiality. This page is *read-only output*.

export const ratingEsg = {
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

  // Top "summary" panel — sunken bevel containing the overall score
  // (left, big numerals) and the three area sub-scores (right, smaller).
  // Visually anchored at the top so the user reads the headline number
  // first, then drills down through the per-metric breakdown below.
  //
  // Flex-wrap rather than grid: a 2-column grid with `minmax(180px, ...)
  // minmax(220px, ...)` imposes a ~420-px floor on the panel, and once
  // the window narrows past it the right column gets pushed out of view
  // with no graceful fallback. `flex: 1 1 <basis>` on each child gives
  // the same paired layout when there is room and a clean vertical
  // stack when there isn't.
  summaryPanel: {
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
    padding: "12px 16px",
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    alignItems: "center",
  } as CSSProperties,

  overallBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: "1 1 180px",
    minWidth: 0,
  } as CSSProperties,

  overallLabel: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLORS.gray700,
  } as CSSProperties,

  overallValue: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "40px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: SYNTAX_SCORE,
    lineHeight: 1,
  } as CSSProperties,

  overallEmpty: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "22px",
    fontWeight: 700,
    color: COLORS.gray700,
    fontStyle: "italic",
    lineHeight: 1,
  } as CSSProperties,

  // Three-row mini-table on the right of the summary panel — one row
  // per ESG area. Each row: label, score, share %.
  //
  // `flex: 1 1 220px, minWidth: 0` makes this a flex item of the
  // summaryPanel above. Wide panels keep it side-by-side with the
  // overall block; narrow panels wrap it to its own row at full width.
  areaSummary: {
    display: "grid",
    gridTemplateColumns: "minmax(90px, max-content) 1fr 56px 56px",
    rowGap: "4px",
    columnGap: "10px",
    alignItems: "baseline",
    flex: "1 1 220px",
    minWidth: 0,
  } as CSSProperties,

  areaSummaryLabel: {
    fontWeight: 700,
  } as CSSProperties,

  areaSummaryValue: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "16px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: SYNTAX_SCORE,
    textAlign: "right",
  } as CSSProperties,

  areaSummaryEmpty: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "13px",
    color: COLORS.gray700,
    fontStyle: "italic",
    textAlign: "right",
  } as CSSProperties,

  areaSummaryShare: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    color: COLORS.gray700,
    fontSize: "12px",
  } as CSSProperties,

  // Per-metric breakdown — Win2K fieldset per area, one row per
  // metric. Mirrors `Strategy`'s row geometry so the user can scan the
  // two pages side-by-side without re-orienting.
  fieldset: {
    border: `1px solid ${BEVEL_DARK}`,
    padding: "6px 12px 8px",
    margin: 0,
  } as CSSProperties,

  legend: {
    padding: "0 6px",
    fontWeight: 700,
  } as CSSProperties,

  // Columns:
  //   Metric name | inline rating bar | numeric rating | share %
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) 2fr 64px 56px",
    alignItems: "center",
    gap: "12px",
    padding: "3px 0",
  } as CSSProperties,

  rowLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  // Sunken bar wrapper. The fill itself is rendered as an SVG
  // `<rect>` inside the wrapper — see `RatingBar` in `RatingEsg.tsx`.
  // SVG fills survive the browser's print ink-saving stripping, so
  // the colour-banded bar prints reliably regardless of the user's
  // "Background graphics" toggle. The wrapper's own bevel via
  // box-shadow is decorative and may or may not survive print —
  // that's acceptable, the bar's information content is the fill.
  bar: {
    position: "relative",
    height: "12px",
    background: SURFACE_WINDOW,
    boxShadow: `inset 1px 1px 0 ${BEVEL_SHADOW}, inset 2px 2px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
    overflow: "hidden",
  } as CSSProperties,

  rating: {
    fontFamily: "Consolas, 'Courier New', monospace",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    fontWeight: 700,
  } as CSSProperties,

  ratingEmpty: {
    fontFamily: "Consolas, 'Courier New', monospace",
    color: COLORS.gray700,
    fontStyle: "italic",
    textAlign: "right",
  } as CSSProperties,

  share: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    color: COLORS.gray700,
  } as CSSProperties,

  // "Not assessed" italic note that takes the bar / rating / share
  // columns of the row when the metric is flagged not material.
  // `gridColumn: 2 / -1` makes it span from the second column to
  // the end so it doesn't wrap inside the 56-px rating column,
  // and so the row reads as one statement ("Human Resources — not
  // assessed") instead of three near-empty cells.
  notAssessedNote: {
    gridColumn: "2 / -1",
    color: COLORS.gray700,
    fontStyle: "italic",
    fontSize: "12px",
  } as CSSProperties,

  // Footer hint pointing at `Strategy` — the user's only lever for
  // changing materiality is over there. Pinned bottom by `marginTop:
  // auto` (paired with the page's `minHeight: 100%`) so a short
  // viewport doesn't leave dead air below the metrics list.
  footer: {
    marginTop: "auto",
    paddingTop: "8px",
    borderTop: `1px solid ${BEVEL_SHADOW}`,
    fontSize: "11px",
    color: COLORS.gray700,
    fontStyle: "italic",
  } as CSSProperties,

  footerLink: {
    color: TEXT_ON_PRIMARY,
    textDecoration: "underline",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    fontStyle: "italic",
  } as CSSProperties,

  // Reserved for future iterations — Win2K all-bevel button matching
  // Strategy's reset button. Not used in the v1 render but kept here
  // as the canonical button shape for any later action.
  primaryButton: {
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
  } as CSSProperties,
} as const;
