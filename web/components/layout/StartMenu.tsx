"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch } from "@/store/hooks";
import { openWindow } from "@/store/slices/windowsSlice";
import {
  AREAS,
  iconPath,
  windowsByArea,
  type WindowArea,
  type WindowDefinition,
} from "@/lib/windows/registry";

// A submenu row that highlights on hover. Tracking happens locally so the
// outer StartMenu doesn't have to manage per-item hover state.
function SubmenuItem({
  def,
  onLaunch,
}: {
  def: WindowDefinition;
  onLaunch: (def: WindowDefinition) => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onLaunch(def)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...theme.startMenu.item,
        ...(hovered ? theme.startMenu.itemHover : null),
      }}
    >
      <img
        src={iconPath(def)}
        alt=""
        aria-hidden
        style={theme.startMenu.itemIcon}
      />
      <span>{def.title}</span>
    </button>
  );
}

export function StartMenu({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [openArea, setOpenArea] = useState<WindowArea | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on Esc and on click anywhere outside the menu (or its trigger).
  // The Start button's mousedown also dismisses the menu, but its handler
  // toggles state directly — we still want the click-outside path so other
  // surfaces (taskbar, desktop) don't leave the menu floating.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return;
      const target = e.target as Node;
      if (ref.current.contains(target)) return;
      // Trigger element identifies itself with data-start-menu-trigger so
      // its own mousedown handler is responsible for the toggle and we
      // don't want this listener to also dispatch onClose (would double-fire).
      if (
        target instanceof Element &&
        target.closest("[data-start-menu-trigger]")
      ) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const launch = (def: WindowDefinition) => {
    dispatch(openWindow(def.id));
    router.push(def.route);
    onClose();
  };

  return (
    <div ref={ref} style={theme.startMenu.root} role="menu">
      <div style={theme.startMenu.banner} aria-hidden>
        Sostenibility
      </div>
      <div style={theme.startMenu.list}>
        {AREAS.map((area) => {
          const expanded = openArea === area;
          const items = windowsByArea(area);
          // Use the first item in the area as the row's icon — gives the
          // top-level area row a non-empty icon slot without inventing a
          // dedicated "area icon" file per area.
          const headerIcon = items[0] ? iconPath(items[0]) : undefined;
          return (
            // Wrapper div so the cursor can travel between the parent row
            // and its submenu without firing onMouseLeave between them
            // (would close the submenu mid-traversal). Intentionally NOT
            // `position: relative` — the submenu is positioned relative to
            // the start menu root (anchored to its bottom edge, above the
            // taskbar) regardless of which row triggered it.
            <div
              key={area}
              onMouseEnter={() => setOpenArea(area)}
              onMouseLeave={() => setOpenArea((a) => (a === area ? null : a))}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={expanded}
                onFocus={() => setOpenArea(area)}
                style={{
                  ...theme.startMenu.item,
                  ...(expanded ? theme.startMenu.itemHover : null),
                }}
              >
                {headerIcon && (
                  <img
                    src={headerIcon}
                    alt=""
                    aria-hidden
                    style={theme.startMenu.itemIcon}
                  />
                )}
                <span>{area}</span>
                <span aria-hidden style={theme.startMenu.itemArrow}>
                  ▶
                </span>
              </button>
              {expanded && (
                <div role="menu" style={theme.startMenu.submenu}>
                  {items.map((def) => (
                    <SubmenuItem key={def.id} def={def} onLaunch={launch} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
