"use client";

import { useState } from "react";
import { useTheme } from "@/lib/themes";
import { iconPath, type WindowDefinition } from "@/lib/windows/registry";

// Presentational icon. All gesture logic (drag with multi-icon group
// support, click → select, dblclick → open, drag-vs-click distinction)
// lives in the parent `Desktop` so a drag can carry every selected icon
// at once. This component just renders at the supplied (x, y) and
// forwards events.
export function DesktopIcon({
  def,
  x,
  y,
  selected,
  onMouseDown,
  onClick,
  onOpen,
}: {
  def: WindowDefinition;
  x: number;
  y: number;
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
        left: x,
        top: y,
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
