"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch } from "@/store/hooks";
import { openWindow } from "@/store/slices/windowsSlice";
import {
  areaIconPath,
  iconPath,
  pagesByArea,
  type WindowArea,
  type WindowDefinition,
} from "@/lib/windows/registry";

// Top-level Start menu row. Mirrors the desktop layout: each area with
// scored metrics appears as an expandable area row whose submenu lists
// the metrics inside (matching the area's folder on the desktop), and
// every Objective entry renders as its own flat leaf row (matching the
// Objective icons that sit loose on the desktop). The two are unified
// here so keyboard navigation cycles all top-level rows uniformly.
type StartMenuRow =
  | { kind: "area"; area: WindowArea; items: WindowDefinition[] }
  | { kind: "leaf"; def: WindowDefinition };

// A leaf menu row (no submenu) that highlights on hover or keyboard
// focus. Used for both submenu items inside an expanded area, and for
// top-level Objective rows that launch directly. Tracking happens
// locally so the outer StartMenu doesn't have to manage per-item
// state.
function LeafItem({
  def,
  onLaunch,
  onKeyDown,
  onMouseEnter,
  onFocus,
  refCallback,
}: {
  def: WindowDefinition;
  onLaunch: (def: WindowDefinition) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onMouseEnter?: () => void;
  onFocus?: () => void;
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
      onMouseEnter={() => {
        setHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
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

  // The flat list of top-level rows. Area rows for E/S/G (each with its
  // own submenu of scored metrics), then a leaf row per Objective entry
  // — Objective items are outputs, not metrics, so a submenu grouping
  // would add a click without grouping anything meaningful. The order
  // here drives both visual order and keyboard cycle order.
  const rows = useMemo<StartMenuRow[]>(
    () => [
      {
        kind: "area",
        area: "Environmental",
        items: pagesByArea("Environmental"),
      },
      { kind: "area", area: "Social", items: pagesByArea("Social") },
      { kind: "area", area: "Governance", items: pagesByArea("Governance") },
      ...pagesByArea("Objective").map(
        (def): StartMenuRow => ({ kind: "leaf", def }),
      ),
    ],
    [],
  );

  // Refs to every top-level row (area buttons + Objective leaf buttons),
  // and to each area row's submenu items. Both are used by the keyboard
  // handlers to move focus across the menu. Submenu ref slots stay null
  // for leaf rows.
  const topRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
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

  // Auto-focus the first top-level row when the menu opens. A keyboard
  // user who pressed Enter on the Start button now lands inside the menu
  // and can navigate with arrow keys without an extra Tab. Mouse users
  // see a focus ring on the first row for a frame; harmless once they
  // engage.
  useEffect(() => {
    topRowRefs.current[0]?.focus();
  }, []);

  const launch = (def: WindowDefinition) => {
    dispatch(openWindow(def.id));
    router.push(def.route);
    onClose();
  };

  // Keyboard handler for a top-level row (area or leaf). Up/Down cycle
  // between rows. Right opens an area row's submenu and focuses its
  // first item; on a leaf row Right is a no-op (nothing to expand).
  // Left closes the whole menu — it's the deepest "back" you can go.
  const handleTopKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    topIndex: number,
  ) => {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = (topIndex + 1) % rows.length;
        topRowRefs.current[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = (topIndex - 1 + rows.length) % rows.length;
        topRowRefs.current[prev]?.focus();
        break;
      }
      case "ArrowRight": {
        const row = rows[topIndex];
        if (row.kind === "area") {
          e.preventDefault();
          setOpenArea(row.area);
          // The submenu was just rendered (or is about to be) — wait a
          // tick so the ref callback has populated submenuRefs before
          // we focus.
          requestAnimationFrame(() => {
            submenuRefs.current[topIndex]?.[0]?.focus();
          });
        }
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
  // Left returns focus to the parent area row (collapsing the submenu
  // would surprise the user; just step back). Enter/Space activate the
  // item via the button's native click — no special handling needed.
  const handleSubmenuKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    topIndex: number,
    itemIndex: number,
  ) => {
    const items = submenuRefs.current[topIndex] ?? [];
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
        topRowRefs.current[topIndex]?.focus();
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
        {rows.map((row, topIndex) => {
          if (row.kind === "leaf") {
            // Objective leaf — no submenu, click launches the window.
            // Hovering / focusing a leaf clears any open area submenu
            // instantly so the cursor doesn't sit alongside an open
            // submenu of an adjacent area while pointed at an unrelated
            // leaf.
            const def = row.def;
            const closeAdjacentSubmenu = () => {
              cancelScheduledClose();
              setOpenArea(null);
            };
            return (
              <LeafItem
                key={def.id}
                def={def}
                onLaunch={launch}
                onKeyDown={(e) => handleTopKey(e, topIndex)}
                onMouseEnter={closeAdjacentSubmenu}
                onFocus={closeAdjacentSubmenu}
                refCallback={(el) => {
                  topRowRefs.current[topIndex] = el;
                }}
              />
            );
          }

          // Area row + (when expanded) its submenu of scored metrics.
          const expanded = openArea === row.area;
          const headerIcon = areaIconPath(row.area);
          return (
            // Wrapper div groups the parent row with its submenu so the
            // cursor traveling between them counts as "still inside" for
            // hit-testing (the submenu is a DOM descendant of this div
            // even though it paints far to the right). Intentionally NOT
            // `position: relative` — the submenu is positioned relative
            // to the start menu root (anchored to its bottom edge, above
            // the taskbar) regardless of which row triggered it. That
            // choice creates a visual gap between row and submenu, so
            // the close is delayed via `scheduleClose` and any subsequent
            // mouseEnter (this row's, an adjacent row's, or the
            // submenu's own DOM ancestry) cancels it.
            <div
              key={row.area}
              onMouseEnter={() => {
                cancelScheduledClose();
                setOpenArea(row.area);
              }}
              onMouseLeave={() => scheduleClose(row.area)}
            >
              <button
                ref={(el) => {
                  topRowRefs.current[topIndex] = el;
                }}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={expanded}
                onFocus={() => setOpenArea(row.area)}
                onKeyDown={(e) => handleTopKey(e, topIndex)}
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
                <span>{row.area}</span>
                <span aria-hidden style={theme.startMenu.itemArrow}>
                  ▶
                </span>
              </button>
              {expanded && (
                <div role="menu" style={theme.startMenu.submenu}>
                  {row.items.map((def, itemIndex) => (
                    <LeafItem
                      key={def.id}
                      def={def}
                      onLaunch={launch}
                      onKeyDown={(e) =>
                        handleSubmenuKey(e, topIndex, itemIndex)
                      }
                      refCallback={(el) => {
                        if (!submenuRefs.current[topIndex]) {
                          submenuRefs.current[topIndex] = [];
                        }
                        submenuRefs.current[topIndex][itemIndex] = el;
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
