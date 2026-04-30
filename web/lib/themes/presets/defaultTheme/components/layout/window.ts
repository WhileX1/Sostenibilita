import type { CSSProperties } from "react";
import {
  SURFACE_PRIMARY,
  SURFACE_WINDOW,
  TEXT_ON_PRIMARY,
  TITLE_BAR_ACTIVE,
  TEXT_ON_TITLE_BAR_ACTIVE,
  TITLE_BAR_INACTIVE,
  TEXT_ON_TITLE_BAR_INACTIVE,
  FONT_SANS,
  BEVEL_LIGHT,
  BEVEL_HILITE,
  BEVEL_SHADOW,
  BEVEL_DARK,
} from "../../constants";

export const window = {
  // Window frame: classic Win2K raised bevel + a soft drop shadow so it
  // visually lifts off the desktop wallpaper.
  root: {
    position: "absolute",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    boxShadow: `
      inset 1px 1px 0 ${BEVEL_LIGHT},
      inset 2px 2px 0 ${BEVEL_HILITE},
      inset -1px -1px 0 ${BEVEL_DARK},
      inset -2px -2px 0 ${BEVEL_SHADOW},
      2px 2px 6px rgba(0, 0, 0, 0.4)
    `,
    padding: "3px",
  } as CSSProperties,

  // Title bar — gradient changes between active/inactive (Win2K convention).
  // The bar is the drag handle: mousedown anywhere outside the buttons starts
  // a drag.
  titleBar: {
    height: "24px",
    padding: "0 5px 0 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "5px",
    background: TITLE_BAR_INACTIVE,
    color: TEXT_ON_TITLE_BAR_INACTIVE,
    fontWeight: 700,
    cursor: "default",
    userSelect: "none",
    flexShrink: 0,
  } as CSSProperties,

  titleBarActive: {
    background: TITLE_BAR_ACTIVE,
    color: TEXT_ON_TITLE_BAR_ACTIVE,
  } as CSSProperties,

  titleBarText: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as CSSProperties,

  // Right-aligned cluster of icon buttons. Sits inside the title bar.
  buttonGroup: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    flexShrink: 0,
  } as CSSProperties,

  // Shared button shape for minimize / maximize / restore / close.
  // The icon glyph (X, _, □, ❐) is supplied as an inline <svg> child.
  // Padding kept as longhand so iconButtonPressed can override individual
  // sides without React's shorthand-vs-longhand mix warning.
  iconButton: {
    appearance: "none",
    border: "none",
    width: "20px",
    height: "18px",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: `inset 1px 1px 0 ${BEVEL_LIGHT}, inset -1px -1px 0 ${BEVEL_DARK}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
    flexShrink: 0,
  } as CSSProperties,

  // Pressed: invert the bevel and nudge the glyph by 1px to fake the click.
  iconButtonPressed: {
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    paddingTop: "1px",
    paddingLeft: "1px",
  } as CSSProperties,

  // Window body: white "document" surface, sunken bevel relative to the
  // beige frame so the boundary reads as an inset region.
  body: {
    flex: 1,
    background: SURFACE_WINDOW,
    color: TEXT_ON_PRIMARY,
    overflow: "auto",
    padding: "16px",
    marginTop: "3px",
    boxShadow: `
      inset 1px 1px 0 ${BEVEL_DARK},
      inset 2px 2px 0 ${BEVEL_SHADOW},
      inset -1px -1px 0 ${BEVEL_LIGHT},
      inset -2px -2px 0 ${BEVEL_HILITE}
    `,
  } as CSSProperties,

  // ── Resize handles ─────────────────────────────────────────────────
  // Eight thin/cornered absolute-positioned hit zones around the frame.
  // Edges sit between the corners; corners are 8×8 and render later in the
  // DOM so they win on hover (corner cursor over edge cursor).

  resizeEdgeN: {
    position: "absolute",
    top: 0, left: "12px", right: "12px",
    height: "6px",
    cursor: "n-resize",
  } as CSSProperties,
  resizeEdgeS: {
    position: "absolute",
    bottom: 0, left: "12px", right: "12px",
    height: "6px",
    cursor: "s-resize",
  } as CSSProperties,
  resizeEdgeE: {
    position: "absolute",
    top: "12px", bottom: "12px", right: 0,
    width: "6px",
    cursor: "e-resize",
  } as CSSProperties,
  resizeEdgeW: {
    position: "absolute",
    top: "12px", bottom: "12px", left: 0,
    width: "6px",
    cursor: "w-resize",
  } as CSSProperties,

  resizeCornerNE: {
    position: "absolute",
    top: 0, right: 0, width: "12px", height: "12px",
    cursor: "ne-resize",
  } as CSSProperties,
  resizeCornerNW: {
    position: "absolute",
    top: 0, left: 0, width: "12px", height: "12px",
    cursor: "nw-resize",
  } as CSSProperties,
  resizeCornerSE: {
    position: "absolute",
    bottom: 0, right: 0, width: "12px", height: "12px",
    cursor: "se-resize",
  } as CSSProperties,
  resizeCornerSW: {
    position: "absolute",
    bottom: 0, left: 0, width: "12px", height: "12px",
    cursor: "sw-resize",
  } as CSSProperties,
} as const;
