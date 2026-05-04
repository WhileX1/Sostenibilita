import type { CSSProperties } from "react";
import {
  SURFACE_PRIMARY,
  TEXT_ON_PRIMARY,
  FONT_SANS,
  BEVEL_LIGHT,
  BEVEL_DARK,
} from "../../constants";

export const startButton = {
  // Default raised state — same bevel pattern as taskbar buttons. Padding
  // kept as longhand so rootPressed can shift individual sides without
  // mixing shorthand and longhand (React would warn).
  root: {
    height: "32px",
    minWidth: "72px",
    paddingTop: 0,
    paddingRight: "8px",
    paddingBottom: 0,
    paddingLeft: "6px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    fontWeight: 700,
    appearance: "none",
    cursor: "pointer",
    border: "none",
    outline: "none",
    boxShadow: `inset 1px 1px 0 ${BEVEL_LIGHT}, inset -1px -1px 0 ${BEVEL_DARK}`,
    flexShrink: 0,
    userSelect: "none",
  } as CSSProperties,

  // Pressed state — applied while the menu is open OR the button is
  // mouse-down. Inverts the bevel and nudges the contents 1px down-right
  // to fake the physical depression.
  rootPressed: {
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    paddingTop: "1px",
    paddingLeft: "5px",
    paddingRight: "5px",
  } as CSSProperties,

  rootFocus: {
    outline: "1px dotted",
    outlineOffset: "-4px",
  } as CSSProperties,

  // Official Windows 1992-2001 logo as a flat <img>. Renders crisp at any
  // size since it's an SVG. Sizing is fixed so the button width stays
  // stable; the SVG's intrinsic aspect ratio takes care of the rest.
  logo: {
    width: "20px",
    height: "18px",
    flexShrink: 0,
    display: "block",
  } as CSSProperties,

  label: {
    fontFamily: "inherit",
  } as CSSProperties,
} as const;
