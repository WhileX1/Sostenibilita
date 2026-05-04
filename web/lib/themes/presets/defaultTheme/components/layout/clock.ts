import type { CSSProperties } from "react";
import { TEXT_ON_PRIMARY, FONT_SANS } from "../../constants";

export const clock = {
  // System-tray clock. Tabular numbers keep the digit columns from jittering
  // when the time updates each minute.
  root: {
    fontFamily: FONT_SANS,
    fontSize: "13px",
    color: TEXT_ON_PRIMARY,
    fontVariantNumeric: "tabular-nums",
    minWidth: "44px",
    textAlign: "right",
  } as CSSProperties,
} as const;
