"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch } from "@/store/hooks";
import { openWindow } from "@/store/slices/windowsSlice";
import {
  AREAS,
  areaIconPath,
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
  onKeyDown,
  refCallback,
}: {
  def: WindowDefinition;
  onLaunch: (def: WindowDefinition) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  refCallback: (el: HTMLButtonElement | null) => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <button
      ref={refCallback}
      type="button"
      role="menuitem"
      onClick={() => onLaunch(def)}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...theme.startMenu.item,
        ...(hovered || focused ? theme.startMenu.itemHover : null),
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

export function StartMenu({
  onClose,
  onEscape,
}: {
  onClose: () => void;
  // Esc / ArrowLeft on the top-level routes here. Lets the parent decide
  // what to do with focus (the StartButton wires this to "close + return
  // focus to the Start button").
  onEscape: () => void;
}) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [openArea, setOpenArea] = useState<WindowArea | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // Refs to the area buttons (one per AREAS entry) and to each area's
  // submenu items (a 2D array indexed by area, then item). Both are used
  // by the keyboard handlers to move focus across the menu.
  const areaRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const submenuRefs = useRef<(HTMLButtonElement | null)[][]>([]);
  // Hover-intent timer for closing the submenu. The submenu is positioned
  // relative to the StartMenu root (anchored above the taskbar regardless
  // of which row triggered it), so there's a horizontal gap between an
  // area row and its submenu — the cursor naturally crosses empty space
  // on its way over. Without a delay, that brief "outside both" moment
  // fires `onMouseLeave` on the row wrapper and unmounts the submenu
  // before the user gets there. 250ms is short enough to feel snappy,
  // long enough to cover a deliberate diagonal traversal.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = (area: WindowArea) => {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => {
      // Only clear openArea if it's still the area whose row was left.
      // A faster mouseEnter on a different area will already have set
      // openArea elsewhere, and we don't want this stale timer to undo
      // that.
      setOpenArea((a) => (a === area ? null : a));
      closeTimer.current = null;
    }, 250);
  };

  // Clear any pending close on unmount so a stale timer doesn't fire
  // setState on a torn-down tree.
  useEffect(() => {
    return () => cancelScheduledClose();
  }, []);

  // Close on Esc and on click anywhere outside the menu (or its trigger).
  // The Start button's click handler also dismisses the menu, but its
  // handler toggles state directly — we still want the click-outside path
  // so other surfaces (taskbar, desktop) don't leave the menu floating.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return;
      const target = e.target as Node;
      if (ref.current.contains(target)) return;
      // Trigger element identifies itself with data-start-menu-trigger so
      // its own click handler is responsible for the toggle and we don't
      // want this listener to also dispatch onClose (would double-fire).
      if (
        target instanceof Element &&
        target.closest("[data-start-menu-trigger]")
      ) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, onEscape]);

  // Auto-focus the first area button when the menu opens. A keyboard user
  // who pressed Enter on the Start button now lands inside the menu and
  // can navigate with arrow keys without an extra Tab. Mouse users see a
  // focus ring on Environmental for a frame; harmless once they engage.
  useEffect(() => {
    areaRefs.current[0]?.focus();
  }, []);

  const launch = (def: WindowDefinition) => {
    dispatch(openWindow(def.id));
    router.push(def.route);
    onClose();
  };

  // Keyboard handler for an area (top-level) button. Up/Down cycle between
  // areas, Right opens the submenu and focuses its first item, Left closes
  // the whole menu (it's the deepest "back" you can go from the top level).
  const handleAreaKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    areaIndex: number,
  ) => {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = (areaIndex + 1) % AREAS.length;
        areaRefs.current[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = (areaIndex - 1 + AREAS.length) % AREAS.length;
        areaRefs.current[prev]?.focus();
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        const area = AREAS[areaIndex];
        setOpenArea(area);
        // The submenu was just rendered (or is about to be) — wait a tick
        // so the ref callback has populated submenuRefs before we focus.
        requestAnimationFrame(() => {
          submenuRefs.current[areaIndex]?.[0]?.focus();
        });
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        onEscape();
        break;
      }
    }
  };

  // Keyboard handler for a submenu item. Up/Down cycle within the submenu,
  // Left returns focus to the parent area button (collapsing the submenu
  // would surprise the user; just step back). Enter/Space activate the
  // item via the button's native click — no special handling needed.
  const handleSubmenuKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    areaIndex: number,
    itemIndex: number,
  ) => {
    const items = submenuRefs.current[areaIndex] ?? [];
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = (itemIndex + 1) % items.length;
        items[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = (itemIndex - 1 + items.length) % items.length;
        items[prev]?.focus();
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        areaRefs.current[areaIndex]?.focus();
        break;
      }
    }
  };

  return (
    <div ref={ref} style={theme.startMenu.root} role="menu">
      <div style={theme.startMenu.banner} aria-hidden>
        Sostenibility
      </div>
      <div style={theme.startMenu.list}>
        {AREAS.map((area, areaIndex) => {
          const expanded = openArea === area;
          const items = windowsByArea(area);
          // Each area has its own SVG at /icons/areas/<area>.svg, distinct
          // from any of its child windows.
          const headerIcon = areaIconPath(area);
          return (
            // Wrapper div groups the parent row with its submenu so the
            // cursor traveling between them counts as "still inside" for
            // hit-testing (the submenu is a DOM descendant of this div even
            // though it paints far to the right). Intentionally NOT
            // `position: relative` — the submenu is positioned relative to
            // the start menu root (anchored to its bottom edge, above the
            // taskbar) regardless of which row triggered it. That choice
            // creates a visual gap between row and submenu, so the close
            // is delayed via `scheduleClose` and any subsequent mouseEnter
            // (this row's, an adjacent row's, or the submenu's own DOM
            // ancestry) cancels it.
            <div
              key={area}
              onMouseEnter={() => {
                cancelScheduledClose();
                setOpenArea(area);
              }}
              onMouseLeave={() => scheduleClose(area)}
            >
              <button
                ref={(el) => {
                  areaRefs.current[areaIndex] = el;
                }}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={expanded}
                onFocus={() => setOpenArea(area)}
                onKeyDown={(e) => handleAreaKey(e, areaIndex)}
                style={{
                  ...theme.startMenu.item,
                  ...(expanded ? theme.startMenu.itemHover : null),
                }}
              >
                <img
                  src={headerIcon}
                  alt=""
                  aria-hidden
                  style={theme.startMenu.itemIcon}
                />
                <span>{area}</span>
                <span aria-hidden style={theme.startMenu.itemArrow}>
                  ▶
                </span>
              </button>
              {expanded && (
                <div role="menu" style={theme.startMenu.submenu}>
                  {items.map((def, itemIndex) => (
                    <SubmenuItem
                      key={def.id}
                      def={def}
                      onLaunch={launch}
                      onKeyDown={(e) =>
                        handleSubmenuKey(e, areaIndex, itemIndex)
                      }
                      refCallback={(el) => {
                        if (!submenuRefs.current[areaIndex]) {
                          submenuRefs.current[areaIndex] = [];
                        }
                        submenuRefs.current[areaIndex][itemIndex] = el;
                      }}
                    />
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
