import type { CSSProperties } from "react";
import {
  BEVEL_DARK,
  BEVEL_HILITE,
  BEVEL_LIGHT,
  BEVEL_SHADOW,
  FONT_SANS,
  SURFACE_PRIMARY,
  TEXT_ON_PRIMARY,
} from "../../../constants";

// Strategy page — first content-bearing page with its own theme slice.
// Hosts the materiality slider grid plus a Win2K-styled `Reset to defaults`
// button. The Reset button keeps its own `*Hover` / `*Focus` / `*Pressed`
// keys (sized for text, not icons), separate from `theme.window.iconButton*`
// which is sized for the title bar's 26×24 chrome glyphs.
export const strategy = {
  page: {
    fontFamily: FONT_SANS,
    color: TEXT_ON_PRIMARY,
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
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

  // Reset button — full Win2K state machine. Padding kept as longhand so
  // `resetButtonPressed` can shift individual sides without mixing shorthand
  // and longhand (React would warn).
  resetButton: {
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

  resetButtonHover: {
    background: BEVEL_HILITE,
  } as CSSProperties,

  resetButtonFocus: {
    outline: "1px dotted",
    outlineOffset: "-4px",
  } as CSSProperties,

  resetButtonPressed: {
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset 2px 2px 0 ${BEVEL_SHADOW}, inset -1px -1px 0 ${BEVEL_LIGHT}, inset -2px -2px 0 ${BEVEL_HILITE}`,
    paddingTop: "5px",
    paddingLeft: "13px",
    paddingRight: "11px",
    paddingBottom: "3px",
  } as CSSProperties,

  fieldset: {
    border: `1px solid ${BEVEL_DARK}`,
    padding: "8px 12px 12px",
    margin: 0,
  } as CSSProperties,

  legend: {
    padding: "0 6px",
    fontWeight: 700,
  } as CSSProperties,

  row: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) 2fr 56px 64px",
    alignItems: "center",
    gap: "12px",
    padding: "4px 0",
  } as CSSProperties,

  rowLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  weight: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  } as CSSProperties,

  share: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  } as CSSProperties,

  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  } as CSSProperties,

  totals: {
    fontStyle: "italic",
  } as CSSProperties,
} as const;
