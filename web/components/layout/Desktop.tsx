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
  ICON_COL_WIDTH,
  ICON_ROW_HEIGHT,
  ICON_PADDING,
} from "@/store/slices/desktopIconsSlice";
import { WINDOW_DEFINITIONS } from "@/lib/windows/registry";
import { DesktopIcon } from "./DesktopIcon";
import { Window } from "./Window";

// Base z-index added to each window's per-instance zIndex when rendered.
// Stays well below the bottombar (z=100) and start menu (z=200) so chrome
// always paints on top, and above the marquee (z=5) so windows hide the
// rubber-band when one is open over an icon.
const WINDOW_Z_BASE = 10;

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
// Two-pass to preserve user-set positions while reflowing overflow:
//
//   Pass 1: every icon whose stored cell still fits in the current grid
//           claims it. First-come-first-served — registry order is the
//           tiebreaker, but in practice the slice prevents duplicate cells
//           so collisions in this pass don't happen.
//   Pass 2: every "overflow" icon (its stored cell is out of bounds, or in
//           the unlikely case its cell was already claimed) gets placed in
//           the first free cell in column-flow scan order.
//
// The output is purely visual — `iconPositions` in Redux is never mutated.
// When the desktop grows back to its original size, every icon's stored
// cell becomes valid again and pass 1 places them where they were.
function resolveIconRenderPositions(
  iconPositions: Record<string, { x: number; y: number }>,
  parentWidth: number,
  parentHeight: number,
): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {};

  // Before the ResizeObserver has fired, fall back to stored positions
  // (no clamp, no reflow) — initial render needs *some* layout.
  if (parentWidth <= 0 || parentHeight <= 0) {
    for (const def of WINDOW_DEFINITIONS) {
      const pos = iconPositions[def.id];
      if (pos) result[def.id] = pos;
    }
    return result;
  }

  // Available space minus padding on both sides, divided by cell pitch.
  // Floors to whole cells — partial cells at the right/bottom edge aren't
  // usable.
  const cols = Math.max(
    1,
    Math.floor((parentWidth - 2 * ICON_PADDING) / ICON_COL_WIDTH),
  );
  const rows = Math.max(
    1,
    Math.floor((parentHeight - 2 * ICON_PADDING) / ICON_ROW_HEIGHT),
  );
  const claimed = new Set<string>();
  const overflowIds: string[] = [];

  // Pass 1: keep stored positions where they still fit.
  for (const def of WINDOW_DEFINITIONS) {
    const pos = iconPositions[def.id];
    if (!pos) continue;
    const col = Math.round((pos.x - ICON_PADDING) / ICON_COL_WIDTH);
    const row = Math.round((pos.y - ICON_PADDING) / ICON_ROW_HEIGHT);
    const fits = col >= 0 && col < cols && row >= 0 && row < rows;
    if (fits) {
      const key = `${col},${row}`;
      if (!claimed.has(key)) {
        claimed.add(key);
        result[def.id] = {
          x: ICON_PADDING + col * ICON_COL_WIDTH,
          y: ICON_PADDING + row * ICON_ROW_HEIGHT,
        };
        continue;
      }
    }
    overflowIds.push(def.id);
  }

  // Pass 2: reflow overflow icons into the first free cell.
  for (const id of overflowIds) {
    let placed = false;
    outer: for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const key = `${c},${r}`;
        if (!claimed.has(key)) {
          claimed.add(key);
          result[id] = {
            x: ICON_PADDING + c * ICON_COL_WIDTH,
            y: ICON_PADDING + r * ICON_ROW_HEIGHT,
          };
          placed = true;
          break outer;
        }
      }
    }
    // Grid full — degraded fallback: stack at the top-left corner. Real
    // workflows shouldn't hit this; the user can enlarge the desktop to
    // recover their layout.
    if (!placed) {
      result[id] = { x: ICON_PADDING, y: ICON_PADDING };
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
  const order = useAppSelector((s) => s.windows.order);
  const byId = useAppSelector((s) => s.windows.byId);
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

    // Snapshot every dragged icon's current position. The drag delta is
    // applied to these snapshots on each mousemove; on mouseup we dispatch
    // each icon's `initial + final delta` to the slice.
    const initial: Record<string, { x: number; y: number }> = {};
    for (const dragId of idsToDrag) {
      const pos = iconPositions[dragId];
      if (pos) initial[dragId] = { x: pos.x, y: pos.y };
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let didDrag = false;
    let releaseUserSelect: (() => void) | null = null;

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
      setDragSession({ ids: idsToDrag, initial, dx, dy });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (releaseUserSelect) releaseUserSelect();
      if (didDrag) {
        wasDraggedRef.current = true;
        setDragSession((current) => {
          if (current) {
            for (const dragId of current.ids) {
              const init = current.initial[dragId];
              if (init) {
                dispatch(
                  setIconPosition({
                    id: dragId,
                    x: init.x + current.dx,
                    y: init.y + current.dy,
                  }),
                );
              }
            }
          }
          return null;
        });
      }
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
        setMarquee({ x1: startX, y1: startY, x2: x, y2: y });
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (releaseUserSelect) releaseUserSelect();
      if (dragged) {
        // Commit selection from the final rectangle.
        setMarquee((current) => {
          if (current) {
            const left = Math.min(current.x1, current.x2);
            const top = Math.min(current.y1, current.y2);
            const w = Math.abs(current.x2 - current.x1);
            const h = Math.abs(current.y2 - current.y1);
            const next = new Set<string>();
            for (const def of WINDOW_DEFINITIONS) {
              const pos = iconPositions[def.id];
              if (!pos) continue;
              if (
                rectsIntersect(
                  pos.x,
                  pos.y,
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
          }
          return null;
        });
      } else {
        // Click without drag — deselect everything.
        setSelectedIds(new Set());
      }
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
          renderX = init ? init.x + dragSession.dx : pos.x;
          renderY = init ? init.y + dragSession.dy : pos.y;
        } else {
          const resolved = resolvedPositions[def.id] ?? pos;
          renderX = resolved.x;
          renderY = resolved.y;
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

      {/* Open windows. Z-stack is read from each instance's `zIndex`
          (bumped on focus by the windows slice) and offset by WINDOW_Z_BASE
          so windows always paint above the marquee. Order in the array no
          longer affects stacking — that frees `order` to be the stable
          insertion order the taskbar relies on. */}
      {order.map((id) => {
        const inst = byId[id];
        if (!inst || inst.isMinimized) return null;
        return (
          <Window
            key={id}
            id={id}
            x={inst.x}
            y={inst.y}
            width={inst.width}
            height={inst.height}
            isActive={id === activeId}
            isMaximized={inst.isMaximized}
            zIndex={WINDOW_Z_BASE + inst.zIndex}
          />
        );
      })}

      {/* Children = the active route's page.tsx, which is reduced to a
          side-effect that dispatches openWindow on mount and renders null.
          Kept inside the desktop so the Suspense boundary scope matches. */}
      {children}
    </div>
  );
}
