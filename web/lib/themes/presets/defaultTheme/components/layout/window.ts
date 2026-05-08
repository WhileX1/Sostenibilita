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

// z-index = 10: above the desktop marquee (z=5) and below the bottombar
// (z=100) and start menu (z=200), so chrome always paints over the window.
const WINDOW_Z = 10;

export const window = {
  // Window frame: classic Win2K raised bevel + a soft drop shadow so it
  // visually lifts off the desktop wallpaper. Sized at 80% of the desktop
  // and centered via `inset: 10%`. Percentages let browser zoom scale the
  // frame proportionally with the desktop instead of clipping it.
  root: {
    position: "absolute",
    inset: "10%",
    zIndex: WINDOW_Z,
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

  // Folder windows open at a tighter default than content windows. A
  // folder is just a navigational shell (sidebar + a small grid of
  // icons) — at 80% of the desktop it leaves a sea of empty white below
  // the icons, which reads as "broken layout" rather than breathing
  // room. The values below land at roughly 56% × 64% of the desktop:
  // wide enough that 6 icons fit comfortably alongside the 150px
  // sidebar without crowding, narrow enough that the empty area below
  // the first row stays modest. The maximise toggle still overrides
  // this via `rootMaximized`, so users who want a full-screen folder
  // can opt in.
  rootFolder: {
    inset: "18% 22%",
  } as CSSProperties,

  // Maximize override: fill the desktop area edge-to-edge. The window is
  // a child of `Desktop`, so `inset: 0` covers the wallpaper but leaves the
  // bottombar alone — the taskbar stays visible.
  rootMaximized: {
    inset: 0,
  } as CSSProperties,

  // Title bar — only one window is ever on screen, so the active gradient
  // is the only one used in practice. The inactive variant is kept for
  // theme completeness and in case future features re-introduce it.
  // 30px tall to comfortably host the larger 26×24 icon buttons; the
  // classic Win2K reference was 18-22px but the larger hit targets are
  // worth the extra height.
  titleBar: {
    height: "30px",
    padding: "0 5px 0 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "5px",
    background: TITLE_BAR_INACTIVE,
    color: TEXT_ON_TITLE_BAR_INACTIVE,
    fontWeight: 700,
    fontSize: "14px",
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

  // Right-aligned cluster holding the minimize / maximize / close buttons.
  // Sits inside the title bar.
  buttonGroup: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  } as CSSProperties,

  // Title-bar icon button — shared shape for minimize / maximize / close.
  // Padding kept as longhand so iconButtonPressed can override individual
  // sides without the shorthand-vs-longhand React warning.
  iconButton: {
    appearance: "none",
    border: "none",
    width: "26px",
    height: "24px",
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

  // Hover: brighten the button face. Win2K classic had no hover state on
  // title-bar buttons — added here as a small UX concession for mouse users
  // who expect cursor feedback. Pressed wins over hover in the merge order.
  iconButtonHover: {
    background: BEVEL_HILITE,
  } as CSSProperties,

  // Keyboard focus ring — same Win2K dotted outline pattern used by the
  // Start button and taskbar buttons. Without this the button is invisible
  // to keyboard users (the base style sets `outline: none`).
  iconButtonFocus: {
    outline: "1px dotted",
    outlineOffset: "-3px",
  } as CSSProperties,

  iconButtonPressed: {
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    paddingTop: "1px",
    paddingLeft: "1px",
  } as CSSProperties,

  // Window body: white "document" surface, sunken bevel relative to the
  // beige frame so the boundary reads as an inset region. The body is the
  // outer frame only — it owns the bevel and the background, and reserves
  // 2px of padding equal to the bevel thickness so the scrollable child
  // sits visually inside the bevel. Without this split, an `overflow: auto`
  // body would paint the scrollbar on top of the top-right bevel corner.
  body: {
    flex: 1,
    background: SURFACE_WINDOW,
    color: TEXT_ON_PRIMARY,
    overflow: "hidden",
    padding: "2px",
    marginTop: "3px",
    display: "flex",
    flexDirection: "column",
    boxShadow: `
      inset 1px 1px 0 ${BEVEL_DARK},
      inset 2px 2px 0 ${BEVEL_SHADOW},
      inset -1px -1px 0 ${BEVEL_LIGHT},
      inset -2px -2px 0 ${BEVEL_HILITE}
    `,
  } as CSSProperties,

  // Inner scroll container — fills the body's content box (which is already
  // inset by the 2px bevel-thickness padding above), owns the actual page
  // padding, and is the element that scrolls. The scrollbar paints at this
  // child's right edge, which is inside the body's bevel — same visual
  // arrangement as a Win2K document window where the scrollbar lives
  // inside the sunken frame, not on top of it.
  bodyContent: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: "14px",
  } as CSSProperties,
} as const;
