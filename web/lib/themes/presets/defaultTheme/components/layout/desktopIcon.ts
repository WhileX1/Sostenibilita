import type { CSSProperties } from "react";
import {
  TEXT_ON_SECONDARY,
  ACCENT_PRIMARY,
  TEXT_ON_ACCENT_PRIMARY,
  FONT_SANS,
} from "../../constants";

export const desktopIcon = {
  root: {
    appearance: "none",
    background: "transparent",
    border: "none",
    padding: "5px 3px",
    width: "100px",
    // Locked height so 1-line and 2-line labels render the same total box.
    // Without this, a 1-line title ("CDA", "Strategy") sits in a ~67px
    // button while a 2-line title ("Consumers and End-Users", "Ethics and
    // Compliance") fills ~83px — at fixed `ICON_ROW_HEIGHT` pitch, that
    // means the *visible* gap between icons changes wherever short and
    // long titles meet. 88px = padding(10) + icon(40) + margin(5) + label
    // (32 ≈ 2 lines). `box-sizing: border-box` is explicit so the height
    // includes the padding deterministically.
    height: "88px",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: TEXT_ON_SECONDARY,
    // No browser focus ring — the dotted outline is supplied by rootFocus.
    outline: "none",
    // Selecting the icon text would interfere with click-to-select and
    // drag-to-move gestures. Lock the label down explicitly.
    userSelect: "none",
    textAlign: "center",
  } as CSSProperties,

  // Win2K desktop focus rectangle: 1px dotted around the icon button, drawn
  // inside via outline-offset so the layout grid spacing stays exact.
  rootFocus: {
    outline: "1px dotted",
    outlineOffset: "-3px",
  } as CSSProperties,

  // Hovered: subtle blue tint over the entire button area. Lighter than the
  // selected state because Win2K never had a "pure hover" highlight on
  // desktop icons — this is a UX concession for mouse users.
  rootHover: {
    background: "rgba(10, 36, 106, 0.18)",
  } as CSSProperties,

  // Selected (sticky after a single click). Stronger tint than rootHover so
  // the user can distinguish the click result from cursor hover.
  rootSelected: {
    background: "rgba(10, 36, 106, 0.35)",
  } as CSSProperties,

  // The 40×40 icon image. Pure sizing — colors and shapes live in the SVG
  // file under public/icons/<id>.svg.
  icon: {
    width: "40px",
    height: "40px",
    display: "block",
    marginBottom: "5px",
    pointerEvents: "none",
  } as CSSProperties,

  // When the icon is selected, fade the artwork slightly so the blue
  // overlay underneath (rootSelected) reads through. A real Win2K-style
  // blue tint would require compositing — the dim is a cheap approximation
  // that conveys the selection state at a glance.
  iconSelected: {
    opacity: 0.7,
  } as CSSProperties,

  // Label (the page name under the icon). White with a 1px black drop-shadow
  // so it stays legible over any wallpaper.
  label: {
    color: TEXT_ON_SECONDARY,
    textShadow: "1px 1px 0 rgba(0, 0, 0, 0.85)",
    fontSize: "13px",
    lineHeight: 1.2,
    padding: "1px 3px",
    maxWidth: "94px",
    overflowWrap: "break-word",
  } as CSSProperties,

  // When the icon button is hovered, the label background flips to the
  // selection blue (Win2K convention) — the shadow is dropped because the
  // bg already provides contrast.
  labelHover: {
    background: ACCENT_PRIMARY,
    color: TEXT_ON_ACCENT_PRIMARY,
    textShadow: "none",
  } as CSSProperties,

  // Selected: same look as labelHover but spread *after* it in the merge
  // chain so a sticky selection wins over a transient hover.
  labelSelected: {
    background: ACCENT_PRIMARY,
    color: TEXT_ON_ACCENT_PRIMARY,
    textShadow: "none",
  } as CSSProperties,
} as const;
