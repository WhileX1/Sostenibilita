import type { CSSProperties } from "react";
import {
  ACCENT_PRIMARY,
  BEVEL_LIGHT,
  BEVEL_SHADOW,
  FONT_SANS,
  SURFACE_PRIMARY,
  TEXT_ON_ACCENT_PRIMARY,
  TEXT_ON_PRIMARY,
} from "../../constants";

// Folder window body — left "quick access" sidebar listing the other
// folders + a fluid grid of the current area's metrics. Mirrors the
// desktop's large-icon view in the grid (40px artwork, label below)
// inside `window.bodyContent` (which already supplies 14px of page
// padding), so the inner layout uses only enough internal gap to keep
// tiles legible.
export const folderView = {
  // Two-column shell: sidebar on the left, metric grid on the right.
  // The negative top/left/bottom margins eat `window.bodyContent`'s
  // 14px padding on those three sides so the sidebar paints flush
  // against the body's left, top, and bottom edges — the Win2K
  // Explorer "Folders" pane convention. The right side keeps the
  // bodyContent padding because the grid lives there and benefits
  // from the breathing room. `min-height: calc(100% + 28px)` claws
  // back the height the negative top/bottom margins took away, so the
  // sidebar can stretch from the body's top edge to its bottom edge
  // even when the grid only fills one row.
  root: {
    display: "flex",
    margin: "-14px 0 -14px -14px",
    minHeight: "calc(100% + 28px)",
    alignItems: "stretch",
    fontFamily: FONT_SANS,
    color: TEXT_ON_PRIMARY,
    fontSize: "13px",
  } as CSSProperties,

  // Quick-access panel. Beige surface (matches the chrome) flush with
  // the body on three sides — the body's own sunken bevel already
  // frames the document area, so giving the sidebar its own four-edge
  // bevel paints a second engraved line right next to the body's,
  // reading as a "double border". Only the right edge needs a
  // separator (the seam between sidebar and grid), drawn here as a
  // single dark vertical line — same convention as the Win2K Explorer
  // Folders pane splitter, minus the drag handle. Width tuned to hold
  // the longest folder label ("Environmental") at the chosen font size
  // without wrapping.
  sidebar: {
    flexShrink: 0,
    width: "150px",
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    padding: "6px 4px",
    borderRight: `1px solid ${BEVEL_SHADOW}`,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  } as CSSProperties,

  // Section header — bold uppercase Tahoma, with a carved 1px divider
  // under it. The divider uses the same `BEVEL_SHADOW + BEVEL_LIGHT`
  // pair as `startMenu.separator` so the line reads as engraved on the
  // beige surface, not painted onto it.
  sidebarTitle: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "4px 6px 6px",
    borderBottom: `1px solid ${BEVEL_SHADOW}`,
    boxShadow: `0 1px 0 ${BEVEL_LIGHT}`,
    marginBottom: "4px",
  } as CSSProperties,

  // Sidebar entry — small icon + label, single click activates. Padded
  // generously to give a comfortable click target inside a narrow
  // strip. Hover/focus flips to selection blue (same convention as
  // `startMenu.itemHover`) so the active row reads at a glance.
  sidebarItem: {
    appearance: "none",
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "5px 6px",
    width: "100%",
    fontFamily: "inherit",
    fontSize: "12px",
    textAlign: "left",
    outline: "none",
  } as CSSProperties,

  sidebarItemHover: {
    background: ACCENT_PRIMARY,
    color: TEXT_ON_ACCENT_PRIMARY,
  } as CSSProperties,

  // Sticky "you are here" state for the current folder's sidebar row.
  // Same blue as `sidebarItemHover` but persistent — spread *after*
  // hover in the merge chain so a passing cursor can't override it.
  // `cursor: default` signals "this isn't an action target" so the
  // user doesn't expect a click to do anything.
  sidebarItemCurrent: {
    background: ACCENT_PRIMARY,
    color: TEXT_ON_ACCENT_PRIMARY,
    cursor: "default",
  } as CSSProperties,

  sidebarItemIcon: {
    width: "24px",
    height: "24px",
    flexShrink: 0,
    display: "block",
    pointerEvents: "none",
  } as CSSProperties,

  // Right-hand grid — `auto-fill` keeps the column count responsive
  // without explicit breakpoints. 92px lower bound matches
  // `desktopIcon.root` width (100px) minus a sliver so a 5th column
  // can squeeze into ~480px of grid width. `flex: 1` claims the
  // remainder of the row after the sidebar; `align-content: start`
  // keeps the tiles packed at the top instead of stretching down
  // vertically. Padding is asymmetric: top/bottom replace the body
  // padding the root just ate, left provides the visual gap to the
  // sidebar, right is supplied by `window.bodyContent` (which the
  // root keeps in place on that side).
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
    gap: "4px",
    alignContent: "start",
    padding: "14px 0 14px 14px",
  } as CSSProperties,

  // Per-tile button — same vertical rhythm as a desktop icon (locked
  // height so 1- and 2-line labels render the same total tile size, see
  // `desktopIcon.root` for the height breakdown).
  item: {
    appearance: "none",
    background: "transparent",
    border: "none",
    padding: "5px 3px",
    width: "100%",
    height: "88px",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    // Default arrow, not the web pointer — matches `desktopIcon.root`
    // and the broader Win2K convention where icons never flipped the
    // cursor.
    cursor: "default",
    fontFamily: "inherit",
    fontSize: "13px",
    color: "inherit",
    outline: "none",
    userSelect: "none",
    textAlign: "center",
  } as CSSProperties,

  itemHover: {
    background: "rgba(10, 36, 106, 0.18)",
  } as CSSProperties,

  // Win2K dotted focus rectangle — drawn inside via outline-offset so the
  // grid spacing stays exact.
  itemFocus: {
    outline: "1px dotted",
    outlineOffset: "-3px",
  } as CSSProperties,

  itemIcon: {
    width: "40px",
    height: "40px",
    display: "block",
    marginBottom: "5px",
    pointerEvents: "none",
  } as CSSProperties,

  // Label sits on the white window body, so it doesn't need the desktop
  // icon's drop-shadow for legibility — drop it for a flatter look.
  itemLabel: {
    fontSize: "12px",
    lineHeight: 1.2,
    padding: "1px 3px",
    maxWidth: "94px",
    overflowWrap: "break-word",
  } as CSSProperties,

  // Hover flips the label background to selection blue (same convention
  // as `desktopIcon.labelHover`) so the active tile reads at a glance.
  itemLabelHover: {
    background: ACCENT_PRIMARY,
    color: TEXT_ON_ACCENT_PRIMARY,
  } as CSSProperties,
} as const;
