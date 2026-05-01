"use client";

import { useState } from "react";
import { useTheme } from "@/lib/themes";
import { iconPath, type WindowDefinition } from "@/lib/windows/registry";

// Presentational icon. All gesture logic (drag with multi-icon group
// support, click → select, dblclick → open, drag-vs-click distinction)
// lives in the parent `Desktop` so a drag can carry every selected icon
// at once. This component just renders at the supplied position and
// forwards events.
//
// `positionStyle` is `{ left, top }` during a drag (absolute pixels) or
// `{ right, top }` at rest for right-anchored icons — the parent decides,
// so the SSR HTML can edge-anchor right-side icons without parentWidth.
export function DesktopIcon({
  def,
  positionStyle,
  selected,
  onMouseDown,
  onClick,
  onOpen,
}: {
  def: WindowDefinition;
  positionStyle: { left?: number; right?: number; top: number };
  selected: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onClick: (id: string, additive: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <button
      type="button"
      onMouseDown={(e) => onMouseDown(def.id, e)}
      onClick={(e) => onClick(def.id, e.ctrlKey || e.metaKey)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen(def.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...theme.desktopIcon.root,
        position: "absolute",
        ...positionStyle,
        ...(hovered ? theme.desktopIcon.rootHover : null),
        ...(selected ? theme.desktopIcon.rootSelected : null),
        ...(focused ? theme.desktopIcon.rootFocus : null),
      }}
    >
      <img
        src={iconPath(def)}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          ...theme.desktopIcon.icon,
          ...(selected ? theme.desktopIcon.iconSelected : null),
        }}
      />
      <span
        style={{
          ...theme.desktopIcon.label,
          ...(hovered ? theme.desktopIcon.labelHover : null),
          ...(selected ? theme.desktopIcon.labelSelected : null),
        }}
      >
        {def.title}
      </span>
    </button>
  );
}
