import type { CSSProperties } from "react";
import {
  SURFACE_PRIMARY,
  TEXT_ON_PRIMARY,
  FONT_SANS,
  BEVEL_LIGHT,
  BEVEL_HILITE,
  BEVEL_DARK,
} from "../../constants";

export const taskbarButton = {
  // Default raised state — represents a "background" window. Padding kept
  // as longhand so rootActive can override sides without React's
  // shorthand-vs-longhand mix warning.
  root: {
    height: "28px",
    minWidth: "140px",
    maxWidth: "220px",
    paddingTop: 0,
    paddingRight: "8px",
    paddingBottom: 0,
    paddingLeft: "8px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    appearance: "none",
    cursor: "pointer",
    border: "none",
    outline: "none",
    boxShadow: `inset 1px 1px 0 ${BEVEL_LIGHT}, inset -1px -1px 0 ${BEVEL_DARK}`,
    flexShrink: 1,
    overflow: "hidden",
    userSelect: "none",
  } as CSSProperties,

  // Active window button: sunken bevel + a 1px diagonal hatch (Win2K used
  // a 50% gray dither) to make the difference unmistakable even when the
  // bevel direction is subtle.
  rootActive: {
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    background: `repeating-linear-gradient(45deg, ${BEVEL_HILITE} 0 1px, ${SURFACE_PRIMARY} 1px 2px)`,
    paddingTop: "1px",
    paddingLeft: "7px",
  } as CSSProperties,

  rootFocus: {
    outline: "1px dotted",
    outlineOffset: "-4px",
  } as CSSProperties,

  // Mini icon (20×20). Sizing only; the SVG carries its own colors.
  icon: {
    width: "20px",
    height: "20px",
    flexShrink: 0,
    display: "block",
    pointerEvents: "none",
  } as CSSProperties,

  label: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
  } as CSSProperties,
} as const;
