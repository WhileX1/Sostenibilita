import type { CSSProperties } from "react";

export const desktop = {
  root: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundImage: "url('/windows_og_background.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    // The desktop fills the area above the bottombar. It owns the
    // window-positioning coordinate system (windows are absolutely positioned
    // children), so we make sure stacking contexts are isolated.
    isolation: "isolate",
  } as CSSProperties,

  // Rubber-band rectangle drawn while the user is dragging on empty desktop
  // space. Win2K used a 1px dotted black outline with a faint blue fill so
  // the selection target stays legible over any wallpaper.
  // z=5 so it paints above icons (auto z) but below windows (>=10+).
  marquee: {
    position: "absolute",
    border: "1px dotted #000",
    background: "rgba(10, 36, 106, 0.12)",
    pointerEvents: "none",
    zIndex: 5,
  } as CSSProperties,
} as const;
