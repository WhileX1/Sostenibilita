import type { CSSProperties } from "react";
import {
  SURFACE_PRIMARY,
  TEXT_ON_PRIMARY,
  ACCENT_PRIMARY,
  TEXT_ON_ACCENT_PRIMARY,
  FONT_SANS,
  BEVEL_LIGHT,
  BEVEL_HILITE,
  BEVEL_SHADOW,
  BEVEL_DARK,
  START_MENU_BANNER,
  TEXT_ON_START_MENU_BANNER,
} from "../../constants";

export const startMenu = {
  // Popover root: pinned to the bottom-left, just above the 30px taskbar.
  // Outer raised bevel + a subtle drop shadow for separation from the
  // wallpaper.
  root: {
    position: "absolute",
    bottom: "36px",
    left: 0,
    minWidth: "260px",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    display: "flex",
    boxShadow: `
      inset 1px 1px 0 ${BEVEL_LIGHT},
      inset 2px 2px 0 ${BEVEL_HILITE},
      inset -1px -1px 0 ${BEVEL_DARK},
      inset -2px -2px 0 ${BEVEL_SHADOW},
      2px 2px 4px rgba(0, 0, 0, 0.35)
    `,
    padding: "3px",
    zIndex: 200,
  } as CSSProperties,

  // Vertical banner on the left edge — the classic Win2K "Windows 2000
  // Professional" strip, here repurposed for the project title. Text runs
  // bottom-to-top via writing-mode + 180° rotation.
  banner: {
    width: "30px",
    background: START_MENU_BANNER,
    color: TEXT_ON_START_MENU_BANNER,
    fontWeight: 700,
    fontSize: "16px",
    letterSpacing: "0.06em",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "10px 0",
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    flexShrink: 0,
    fontFamily: "Tahoma, sans-serif",
  } as CSSProperties,

  // Content column to the right of the banner — holds menu items and
  // separators.
  list: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "3px",
    minWidth: "220px",
  } as CSSProperties,

  // Single menu row: icon (optional) + label + (optional) submenu arrow.
  // Looks like a button by default, gets blue highlight on hover/keyboard
  // focus.
  item: {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: TEXT_ON_PRIMARY,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px 8px 7px 6px",
    fontFamily: "inherit",
    fontSize: "14px",
    textAlign: "left",
    width: "100%",
    outline: "none",
    position: "relative",
  } as CSSProperties,

  itemHover: {
    background: ACCENT_PRIMARY,
    color: TEXT_ON_ACCENT_PRIMARY,
  } as CSSProperties,

  // Visual marker for an entry that opens a submenu. Sits at the right edge
  // of the row.
  itemArrow: {
    marginLeft: "auto",
    fontSize: "12px",
    fontFamily: "inherit",
  } as CSSProperties,

  // Per-row icon — small SVG image. Sizing only; colors live in the SVG.
  itemIcon: {
    width: "22px",
    height: "22px",
    flexShrink: 0,
    display: "block",
    pointerEvents: "none",
  } as CSSProperties,

  // Horizontal divider between menu groups — carved 1px line.
  separator: {
    height: "1px",
    background: BEVEL_SHADOW,
    boxShadow: `0 1px 0 ${BEVEL_LIGHT}`,
    margin: "3px 2px",
    flexShrink: 0,
  } as CSSProperties,

  // Submenu floats to the right of the start menu root, anchored to the
  // root's *bottom* edge (just above the taskbar) and grows upward as it
  // gets taller. This guarantees the submenu never starts below the
  // taskbar regardless of which area row triggered it. Positioning is
  // relative to the start menu root because we removed the row-wrapper's
  // `position: relative` from the component.
  submenu: {
    position: "absolute",
    left: "100%",
    bottom: "3px",
    minWidth: "240px",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    padding: "3px",
    boxShadow: `
      inset 1px 1px 0 ${BEVEL_LIGHT},
      inset 2px 2px 0 ${BEVEL_HILITE},
      inset -1px -1px 0 ${BEVEL_DARK},
      inset -2px -2px 0 ${BEVEL_SHADOW},
      2px 2px 4px rgba(0, 0, 0, 0.35)
    `,
    zIndex: 201,
  } as CSSProperties,
} as const;
