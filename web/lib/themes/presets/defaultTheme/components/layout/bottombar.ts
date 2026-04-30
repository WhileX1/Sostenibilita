import type { CSSProperties } from "react";
import {
  SURFACE_PRIMARY,
  TEXT_ON_PRIMARY,
  FONT_SANS,
  BEVEL_LIGHT,
  BEVEL_DARK,
} from "../../constants";

export const bottombar = {
  // Taskbar root: thin beige strip with a single highlight line on top
  // (Win2K had a one-pixel raised edge against the desktop wallpaper).
  root: {
    height: "36px",
    flexShrink: 0,
    background: SURFACE_PRIMARY,
    color: TEXT_ON_PRIMARY,
    fontFamily: FONT_SANS,
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 5px",
    boxShadow: `inset 0 1px 0 ${BEVEL_LIGHT}`,
    // The taskbar must paint above all windows — windows sit in the desktop
    // layer below, taskbar is chrome and outranks them.
    position: "relative",
    zIndex: 100,
    // Chrome — text in here should never be selectable.
    userSelect: "none",
  } as CSSProperties,

  // Vertical 2px groove — used to visually separate the start button area
  // from the task list and the task list from the system tray.
  separator: {
    width: "2px",
    height: "26px",
    boxShadow: `inset 1px 0 0 ${BEVEL_DARK}, inset -1px 0 0 ${BEVEL_LIGHT}`,
    flexShrink: 0,
    margin: "0 3px",
  } as CSSProperties,

  // Container for taskbar buttons. Flex-wraps disabled so we get classic
  // single-row truncation; overflow hides anything past the right edge.
  taskList: {
    flex: 1,
    display: "flex",
    gap: "2px",
    overflow: "hidden",
    minWidth: 0,
  } as CSSProperties,

  // System tray: a recessed area on the right that hosts the clock (and any
  // future tray icons). Sunken bevel.
  systemTray: {
    display: "flex",
    alignItems: "center",
    height: "28px",
    padding: "0 10px",
    boxShadow: `inset 1px 1px 0 ${BEVEL_DARK}, inset -1px -1px 0 ${BEVEL_LIGHT}`,
    flexShrink: 0,
  } as CSSProperties,
} as const;
