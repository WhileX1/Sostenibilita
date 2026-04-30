import type { CSSProperties } from "react";
import {
  SURFACE_SECONDARY,
  BORDER_SECONDARY,
  TEXT_ON_SECONDARY,
  FONT_SANS,
} from "../../constants";

export const topbar = {
  root: {
    height: "28px",
    background: SURFACE_SECONDARY,
    borderBottom: `1px solid ${BORDER_SECONDARY}`,
    padding: "0 6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontFamily: FONT_SANS,
    // The topbar is chrome — text in here should never be selectable. Stops
    // a marquee drag started near the top of the desktop from accidentally
    // highlighting the brand label when the cursor crosses into this strip.
    userSelect: "none",
  } as CSSProperties,

  brand: {
    fontSize: "13px",
    fontWeight: 700,
    color: TEXT_ON_SECONDARY,
    letterSpacing: 0,
  } as CSSProperties,
} as const;
