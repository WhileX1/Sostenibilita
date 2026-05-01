"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openWindow } from "@/store/slices/windowsSlice";
import {
  setIconPosition,
  iconPixelOf,
  ICON_COL_WIDTH,
  ICON_ROW_HEIGHT,
  ICON_PADDING,
  type IconPosition,
  type IconSide,
} from "@/store/slices/desktopIconsSlice";
import { WINDOW_DEFINITIONS } from "@/lib/windows/registry";
import { DesktopIcon } from "./DesktopIcon";
import { Window } from "./Window";

// Approximate icon bounding box for marquee intersection + render clamping.
// Width is exact (matches `theme.desktopIcon.root.width`); height is the
// rendered total (icon 40 + label up to ~30 + padding 10).
const ICON_BBOX_W = 100;
const ICON_BBOX_H = 80;

// Movement threshold before a desktop mousedown promotes from a click to a
// marquee drag, and before an icon mousedown promotes from a click to a
// position drag. Same value because the gestures feel comparable.
const MARQUEE_THRESHOLD = 4;
const ICON_DRAG_THRESHOLD = 5;

interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DragSession {
  ids: string[];
  initial: Record<string, { x: number; y: number }>;
  dx: number;
  dy: number;
}

function rectsIntersect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

// Compute a render position for every icon given the current desktop size.
// Stored cells are side-anchored — column 0 hugs the chosen edge, columns
// grow inward — so icons stay pinned to the left/right strips as the
// desktop resizes (and stay visible behind a centered 80% window).
//
// Two-pass to preserve user-set positions while reflowing overflow:
//
//   Pass 1: every icon whose stored cell still fits in the current grid
//           claims it. First-come-first-served — registry order is the
//           tiebreaker, but the slice prevents duplicate cells so
//           collisions in this pass don't normally happen.
//   Pass 2: every "overflow" icon (its stored cell is out of bounds, or
//           in the unlikely case its cell was already claimed) gets
//           placed in the first free cell on its preferred side, then
//           on the other side if that side is full.
//
// `byId` in Redux is never mutated — when the desktop grows back to its
// original size, every icon's stored cell becomes valid again and pass 1
// places them where they were.
function resolveIconRenderPositions(
  iconPositions: Record<string, IconPosition>,
  parentWidth: number,
  parentHeight: number,
): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {};

  // Before the ResizeObserver has fired, fall back to a parent-less pixel
  // map (assume there is enough horizontal space). Every render after the
  // first will have real measurements.
  if (parentWidth <= 0 || parentHeight <= 0) {
    for (const def of WINDOW_DEFINITIONS) {
      const pos = iconPositions[def.id];
      if (pos) result[def.id] = iconPixelOf(pos, parentWidth);
    }
    return result;
  }

  // How many cells fit, in each axis. Floors to whole cells — partial
  // cells at the right/bottom edge aren't usable.
  const maxCols = Math.max(
    1,
    Math.floor((parentWidth - 2 * ICON_PADDING) / ICON_COL_WIDTH),
  );
  const maxRows = Math.max(
    1,
    Math.floor((parentHeight - 2 * ICON_PADDING) / ICON_ROW_HEIGHT),
  );
  // Cells claimed in this layout pass. Keyed `<side>:<col>:<row>`.
  const claimed = new Set<string>();
  const overflow: { id: string; preferredSide: IconSide }[] = [];

  // Pass 1: keep stored positions where they still fit.
  for (const def of WINDOW_DEFINITIONS) {
    const pos = iconPositions[def.id];
    if (!pos) continue;
    const fits =
      pos.col >= 0 &&
      pos.col < maxCols &&
      pos.row >= 0 &&
      pos.row < maxRows;
    if (fits) {
      const key = `${pos.side}:${pos.col}:${pos.row}`;
      if (!claimed.has(key)) {
        claimed.add(key);
        result[def.id] = iconPixelOf(pos, parentWidth);
        continue;
      }
    }
    overflow.push({ id: def.id, preferredSide: pos.side });
  }

  // Pass 2: reflow overflow icons into the first free cell, preferring
  // the side they were stored on. If that side is full, spill onto the
  // other side instead of the top-left corner.
  for (const { id, preferredSide } of overflow) {
    const sides: IconSide[] =
      preferredSide === "left" ? ["left", "right"] : ["right", "left"];
    let placed = false;
    outer: for (const side of sides) {
      for (let c = 0; c < maxCols; c++) {
        for (let r = 0; r < maxRows; r++) {
          const key = `${side}:${c}:${r}`;
          if (!claimed.has(key)) {
            claimed.add(key);
            result[id] = iconPixelOf(
              { side, col: c, row: r },
              parentWidth,
            );
            placed = true;
            break outer;
          }
        }
      }
    }
    // No free cell on either side — degraded fallback. Real workflows
    // shouldn't hit this; the user can enlarge the desktop to recover.
    if (!placed) {
      result[id] = iconPixelOf(
        { side: preferredSide, col: 0, row: 0 },
        parentWidth,
      );
    }
  }

  return result;
}

// Sets the document body's text-selection lock during a drag. Returns a
// cleanup function that restores the previous value. Without this, dragging
// near label-bearing chrome (taskbar, topbar) accidentally highlights text.
function lockBodyUserSelect(): () => void {
  const prev = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  return () => {
    document.body.style.userSelect = prev;
  };
}

export function Desktop({ children }: { children?: ReactNode }) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const activeId = useAppSelector((s) => s.windows.activeId);
  const iconPositions = useAppSelector((s) => s.desktopIcons.byId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  // Live drag of one or more selected icons. While non-null, every id in
  // `ids` renders at `initial[id] + (dx, dy)` and the slice hasn't seen
  // any of the moves yet — final positions dispatch on mouseup.
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  // Tracks the desktop's current content-rect so render-time clamping can
  // pull icons back into view if the viewport shrunk under them.
  const [parentSize, setParentSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  // Set true when an icon mousedown→mouseup actually moved past threshold;
  // checked by the click/dblclick handlers to suppress the side-effects
  // that would otherwise fire after a drag.
  const wasDraggedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Track the desktop content rect. Render-time clamping reads from
  // `parentSize` so an icon whose stored position falls outside the new
  // bounds renders at the edge instead of vanishing. Stored state is
  // preserved — if the viewport grows back, icons return to their original
  // positions.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setParentSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resolved render positions for non-dragged icons. Recomputed only when
  // the inputs change so the two-pass algorithm doesn't run on every render.
  const resolvedPositions = useMemo(
    () =>
      resolveIconRenderPositions(
        iconPositions,
        parentSize.width,
        parentSize.height,
      ),
    [iconPositions, parentSize.width, parentSize.height],
  );

  // Click on an icon. With Ctrl/Cmd held, the click is additive. Without,
  // it replaces. Suppressed when a drag actually moved.
  const handleIconClick = (id: string, additive: boolean) => {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  };

  const handleIconOpen = (id: string) => {
    if (wasDraggedRef.current) {
      // A drag completing on the same icon emits dblclick too in some
      // browsers — guard like we do for click.
      wasDraggedRef.current = false;
      return;
    }
    const def = WINDOW_DEFINITIONS.find((w) => w.id === id);
    if (!def) return;
    dispatch(openWindow(def.id));
    router.push(def.route);
  };

  // Mousedown on a desktop icon. Either:
  // - the icon is already part of a multi-selection → drag the whole group
  // - the icon is unselected → make it the new sole selection AND drag it
  // - the icon is the only selected → drag it alone (selection unchanged)
  const handleIconMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const parentRect = root.getBoundingClientRect();

    // Decide which ids ride the drag.
    const dragsGroup = selectedIds.has(id) && selectedIds.size > 1;
    const idsToDrag = dragsGroup ? Array.from(selectedIds) : [id];
    // Promote the clicked icon into the selection if it wasn't already.
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set([id]));
    }

    // Snapshot every dragged icon's current pixel position. Stored cells
    // are side-anchored, so the snapshot needs the desktop's measured
    // width to translate back into screen pixels.
    const initial: Record<string, { x: number; y: number }> = {};
    for (const dragId of idsToDrag) {
      const pos = iconPositions[dragId];
      if (pos) initial[dragId] = iconPixelOf(pos, parentRect.width);
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let didDrag = false;
    let releaseUserSelect: (() => void) | null = null;
    // Track the latest drag delta in a closure so onUp can read it
    // directly. Reading via setState's updater callback would mean doing
    // side effects (dispatch) inside the updater, which React 19's dev
    // mode flags as setState-in-render — updaters must be pure.
    let lastDelta = { dx: 0, dy: 0 };

    const onMove = (ev: MouseEvent) => {
      const dxRaw = ev.clientX - startX;
      const dyRaw = ev.clientY - startY;
      if (
        !didDrag &&
        Math.hypot(dxRaw, dyRaw) > ICON_DRAG_THRESHOLD
      ) {
        didDrag = true;
        releaseUserSelect = lockBodyUserSelect();
      }
      if (!didDrag) return;

      // Clamp the group delta so the most-restrictive icon stays in bounds.
      // We collapse all four edge constraints into a single (dx, dy) the
      // whole group shares, which keeps rigid-body group movement.
      let dx = dxRaw;
      let dy = dyRaw;
      for (const dragId of idsToDrag) {
        const init = initial[dragId];
        if (!init) continue;
        if (init.x + dx < 0) dx = -init.x;
        if (init.x + dx > parentRect.width - ICON_BBOX_W) {
          dx = parentRect.width - ICON_BBOX_W - init.x;
        }
        if (init.y + dy < 0) dy = -init.y;
        if (init.y + dy > parentRect.height - ICON_BBOX_H) {
          dy = parentRect.height - ICON_BBOX_H - init.y;
        }
      }
      lastDelta = { dx, dy };
      setDragSession({ ids: idsToDrag, initial, dx, dy });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (releaseUserSelect) releaseUserSelect();
      if (didDrag) {
        wasDraggedRef.current = true;
        for (const dragId of idsToDrag) {
          const init = initial[dragId];
          if (init) {
            dispatch(
              setIconPosition({
                id: dragId,
                x: init.x + lastDelta.dx,
                y: init.y + lastDelta.dy,
                parentWidth: parentRect.width,
              }),
            );
          }
        }
      }
      setDragSession(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Mousedown on the desktop root (not on an icon or window). Either:
  // - the gesture stays still → treated as a click on empty space that
  //   clears the current selection.
  // - the gesture drags > MARQUEE_THRESHOLD pixels → live rubber-band
  //   rectangle that, on release, replaces the selection with whichever
  //   icons intersect.
  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // an icon/window will handle it
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    let dragged = false;
    let releaseUserSelect: (() => void) | null = null;
    // Track the latest marquee rect in a closure so onUp can read it
    // directly without going through setMarquee's updater callback —
    // updaters must be pure (no setSelectedIds inside).
    let lastRect: MarqueeRect | null = null;

    const onMove = (ev: MouseEvent) => {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      if (
        !dragged &&
        Math.hypot(x - startX, y - startY) > MARQUEE_THRESHOLD
      ) {
        dragged = true;
        releaseUserSelect = lockBodyUserSelect();
      }
      if (dragged) {
        const next = { x1: startX, y1: startY, x2: x, y2: y };
        lastRect = next;
        setMarquee(next);
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (releaseUserSelect) releaseUserSelect();
      if (dragged && lastRect) {
        // Commit selection from the final rectangle. Marquee intersection
        // uses the resolved render positions, not the raw stored cells —
        // what the user sees and what they can sweep over has to match.
        const left = Math.min(lastRect.x1, lastRect.x2);
        const top = Math.min(lastRect.y1, lastRect.y2);
        const w = Math.abs(lastRect.x2 - lastRect.x1);
        const h = Math.abs(lastRect.y2 - lastRect.y1);
        const next = new Set<string>();
        for (const def of WINDOW_DEFINITIONS) {
          const render = resolvedPositions[def.id];
          if (!render) continue;
          if (
            rectsIntersect(
              render.x,
              render.y,
              ICON_BBOX_W,
              ICON_BBOX_H,
              left,
              top,
              w,
              h,
            )
          ) {
            next.add(def.id);
          }
        }
        setSelectedIds(next);
      } else if (!dragged) {
        // Click without drag — deselect everything.
        setSelectedIds(new Set());
      }
      setMarquee(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Style for the live marquee rectangle. Inline because the geometry is
  // dynamic; the static parts come from the theme.
  let marqueeStyle: CSSProperties | null = null;
  if (marquee) {
    marqueeStyle = {
      ...theme.desktop.marquee,
      left: Math.min(marquee.x1, marquee.x2),
      top: Math.min(marquee.y1, marquee.y2),
      width: Math.abs(marquee.x2 - marquee.x1),
      height: Math.abs(marquee.y2 - marquee.y1),
    };
  }

  return (
    <div ref={rootRef} style={theme.desktop.root} onMouseDown={handleDesktopMouseDown}>
      {WINDOW_DEFINITIONS.map((def) => {
        const pos = iconPositions[def.id];
        if (!pos) return null;
        // During a drag, every icon in the session renders at `init + delta`
        // (the handler already clamped the delta against bounds). At rest,
        // the resolver decides where the icon goes — keeping a stored cell
        // when it still fits, reflowing into the next free cell when not.
        let renderX: number;
        let renderY: number;
        const inDrag = dragSession?.ids.includes(def.id) ?? false;
        if (inDrag && dragSession) {
          const init = dragSession.initial[def.id];
          renderX = init ? init.x + dragSession.dx : ICON_PADDING;
          renderY = init ? init.y + dragSession.dy : ICON_PADDING;
        } else {
          const resolved = resolvedPositions[def.id];
          renderX = resolved?.x ?? ICON_PADDING;
          renderY = resolved?.y ?? ICON_PADDING;
        }
        return (
          <DesktopIcon
            key={def.id}
            def={def}
            x={renderX}
            y={renderY}
            selected={selectedIds.has(def.id)}
            onMouseDown={handleIconMouseDown}
            onClick={handleIconClick}
            onOpen={handleIconOpen}
          />
        );
      })}

      {marqueeStyle && <div aria-hidden style={marqueeStyle} />}

      {/* Foreground window. Only `activeId` renders — every other open id
          stays in `s.windows.order` (and on the taskbar) but is not in the
          DOM. No z-stacking layer: the active window paints above the
          marquee thanks to its own `theme.window.root.zIndex`. */}
      {activeId && <Window id={activeId} />}

      {/* Children = the active route's page.tsx, which is reduced to a
          side-effect that dispatches openWindow on mount and renders null.
          Kept inside the desktop so the Suspense boundary scope matches. */}
      {children}
    </div>
  );
}
