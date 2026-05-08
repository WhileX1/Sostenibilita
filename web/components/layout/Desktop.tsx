"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useHydrated } from "@/store/Providers";
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
import { DESKTOP_ITEMS } from "@/lib/windows/registry";
import { DesktopIcon } from "./DesktopIcon";
import { Window } from "./Window";

// Icon bounding box for marquee intersection + render clamping. Both
// match the locked dimensions of `desktopIcon.root` (width 100, height 88
// — see comment there for the height breakdown). Drag clamp uses these
// to keep an icon fully on-screen; marquee uses them to decide which
// icons the rubber-band rectangle has swept.
const ICON_BBOX_W = 100;
const ICON_BBOX_H = 88;

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

// Render a stored cell as edge-anchored CSS — `left` for left-side icons,
// `right` for right-side icons. The browser handles right-edge anchoring
// natively, so right-side icons paint at the correct position even on the
// SSR HTML before any measurement has happened. (Computing absolute pixels
// from `parentWidth` and using `left:` for right icons is what produced the
// on-load flash: `parentWidth = 0` gave x = -112, then ResizeObserver
// fired and the icon snapped to the actual right edge.)
function iconStyleOf(pos: IconPosition): {
  left?: number;
  right?: number;
  top: number;
} {
  const offset = ICON_PADDING + pos.col * ICON_COL_WIDTH;
  const top = ICON_PADDING + pos.row * ICON_ROW_HEIGHT;
  return pos.side === "left" ? { left: offset, top } : { right: offset, top };
}

// Compute a render cell for every icon given the current desktop size.
// Returns reflowed `(side, col, row)` triples — the renderer translates
// those to CSS via `iconStyleOf`, and the marquee/drag handlers translate
// to absolute pixels via `iconPixelOf` when they need pixel math.
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
function resolveIconRenderCells(
  iconPositions: Record<string, IconPosition>,
  parentWidth: number,
  parentHeight: number,
): Record<string, IconPosition> {
  const result: Record<string, IconPosition> = {};

  // Before measurement we can't run the two-pass reflow (we don't know
  // maxCols / maxRows). Return the raw stored cells — they're valid by
  // construction, and the renderer's edge-anchored CSS positions them
  // correctly on both sides without needing parentWidth.
  if (parentWidth <= 0 || parentHeight <= 0) {
    for (const def of DESKTOP_ITEMS) {
      const pos = iconPositions[def.id];
      if (pos) result[def.id] = pos;
    }
    return result;
  }

  // How many cells fit per side without left- and right-anchored columns
  // overlapping in the middle. A naive `floor((W − 2·pad) / cellW)` gives
  // total cols across the whole desktop — but each "side" is anchored to
  // its own edge, so left col c spans pixels [pad + c·W, pad + (c+1)·W]
  // and right col c spans [W_total − pad − (c+1)·W, W_total − pad − c·W].
  // They stop overlapping when 2·(c+1)·W + 2·pad ≤ W_total. We cap each
  // side at that limit so a narrow desktop / aggressive zoom can never
  // place left and right overflow icons on top of each other.
  const maxColsPerSide = Math.max(
    1,
    Math.floor((parentWidth - 2 * ICON_PADDING) / (2 * ICON_COL_WIDTH)),
  );
  const maxRows = Math.max(
    1,
    Math.floor((parentHeight - 2 * ICON_PADDING) / ICON_ROW_HEIGHT),
  );
  // Cells claimed in this layout pass. Keyed `<side>:<col>:<row>`.
  const claimed = new Set<string>();
  const overflow: { id: string; preferredSide: IconSide }[] = [];

  // Pass 1: keep stored positions where they still fit.
  for (const def of DESKTOP_ITEMS) {
    const pos = iconPositions[def.id];
    if (!pos) continue;
    const fits =
      pos.col >= 0 &&
      pos.col < maxColsPerSide &&
      pos.row >= 0 &&
      pos.row < maxRows;
    if (fits) {
      const key = `${pos.side}:${pos.col}:${pos.row}`;
      if (!claimed.has(key)) {
        claimed.add(key);
        result[def.id] = pos;
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
      for (let c = 0; c < maxColsPerSide; c++) {
        for (let r = 0; r < maxRows; r++) {
          const key = `${side}:${c}:${r}`;
          if (!claimed.has(key)) {
            claimed.add(key);
            result[id] = { side, col: c, row: r };
            placed = true;
            break outer;
          }
        }
      }
    }
    // No free cell on either side — degraded fallback. Real workflows
    // shouldn't hit this; the user can enlarge the desktop to recover.
    if (!placed) {
      result[id] = { side: preferredSide, col: 0, row: 0 };
    }
  }

  return result;
}

// Sets the document body's text-selection lock during a drag. Returns a
// cleanup function that restores the previous value. Without this, dragging
// near label-bearing chrome (taskbar) accidentally highlights text.
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
  // Suppress the icon grid until the post-mount HYDRATE has merged the
  // persisted layout. Without this, icons render at default `autoPosition`
  // slots for one frame and then snap to the user's saved positions —
  // visible as a flash on every reload.
  const hydrated = useHydrated();

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
  //
  // Uses `useLayoutEffect` (not `useEffect`) and a synchronous initial
  // `getBoundingClientRect` so the first client paint after hydration
  // already has real bounds. The flash-on-load that this used to fix is
  // now also impossible at the render layer — icons paint via edge-
  // anchored CSS and don't depend on `parentWidth` to be visible — but
  // the synchronous measurement still matters: if the user marquees /
  // drags before ResizeObserver's async first callback fires, the pixel
  // math (`iconPixelOf`, intersection rects) would otherwise compute
  // against a stale `{0, 0}`.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setParentSize({ width: rect.width, height: rect.height });
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setParentSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resolved (side, col, row) cells for every icon. Reflows overflow
  // when the desktop shrinks; falls back to stored cells when not yet
  // measured. Memoized so the two-pass algorithm doesn't run on every
  // render.
  const resolvedCells = useMemo(
    () =>
      resolveIconRenderCells(
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
    const def = DESKTOP_ITEMS.find((w) => w.id === id);
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

    // Snapshot every dragged icon's current pixel position. Reads the
    // *resolved* cell (post-reflow), not the stored one — when the
    // desktop has shrunk under zoom and pushed an icon to a fallback
    // slot, the user clicks its rendered position, so the drag must
    // start from there. Mixing the two coordinate systems would make
    // the icon snap to its pre-reflow pixel on mousedown.
    const initial: Record<string, { x: number; y: number }> = {};
    for (const dragId of idsToDrag) {
      const cell = resolvedCells[dragId];
      if (cell) initial[dragId] = iconPixelOf(cell, parentRect.width);
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
  //   rectangle that updates the selection on every move with whichever
  //   icons currently intersect (so swept icons highlight in real time,
  //   matching Win2K behavior — without the live update only the icon
  //   directly under the cursor would visibly react).
  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // an icon/window will handle it
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    let dragged = false;
    let releaseUserSelect: (() => void) | null = null;

    // Compute the set of icons whose bbox intersects the marquee. Reads
    // the *resolved* cell (post-reflow), converted to absolute pixels —
    // what the user sees and what they can sweep over has to match.
    // Captured from the render at mousedown time; icons can't reflow
    // mid-drag, so the snapshot stays correct for the duration.
    const intersectingIds = (m: MarqueeRect): Set<string> => {
      const left = Math.min(m.x1, m.x2);
      const top = Math.min(m.y1, m.y2);
      const w = Math.abs(m.x2 - m.x1);
      const h = Math.abs(m.y2 - m.y1);
      const next = new Set<string>();
      for (const def of DESKTOP_ITEMS) {
        const cell = resolvedCells[def.id];
        if (!cell) continue;
        const { x: rx, y: ry } = iconPixelOf(cell, rect.width);
        if (
          rectsIntersect(rx, ry, ICON_BBOX_W, ICON_BBOX_H, left, top, w, h)
        ) {
          next.add(def.id);
        }
      }
      return next;
    };

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
        const nextRect = { x1: startX, y1: startY, x2: x, y2: y };
        setMarquee(nextRect);
        // Commit the selection on every move so swept icons show their
        // selected state (rootSelected tint + labelSelected blue) live
        // under the rubber-band. React 18 auto-batches both setStates
        // into a single render even from a document-level handler.
        setSelectedIds(intersectingIds(nextRect));
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (releaseUserSelect) releaseUserSelect();
      if (!dragged) {
        // Click without drag — deselect everything.
        setSelectedIds(new Set());
      }
      // When dragged, the selection is already current from the last
      // onMove; nothing left to commit here.
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
      {/* Static wrapper — desktop root is `position: relative`, so absolute
          children inside this static div still anchor against the desktop,
          not the wrapper. `visibility` cascades while hydration is pending,
          hiding the default-positioned icons before they snap to persisted
          slots. */}
      <div style={{ visibility: hydrated ? "visible" : "hidden" }}>
      {DESKTOP_ITEMS.map((def) => {
        const cell = resolvedCells[def.id];
        if (!cell) return null;
        // During a drag, every icon in the session renders at absolute
        // `init + delta` pixels (the handler already clamped the delta
        // against bounds). At rest, the resolver gives a (side, col, row)
        // and the renderer uses edge-anchored CSS — `right:` for right-
        // side icons — so the SSR HTML and the first client paint have
        // them at the correct position without depending on parentWidth.
        let positionStyle: { left?: number; right?: number; top: number };
        const inDrag = dragSession?.ids.includes(def.id) ?? false;
        if (inDrag && dragSession) {
          const init = dragSession.initial[def.id];
          positionStyle = init
            ? { left: init.x + dragSession.dx, top: init.y + dragSession.dy }
            : { left: ICON_PADDING, top: ICON_PADDING };
        } else {
          positionStyle = iconStyleOf(cell);
        }
        return (
          <DesktopIcon
            key={def.id}
            def={def}
            positionStyle={positionStyle}
            selected={selectedIds.has(def.id)}
            onMouseDown={handleIconMouseDown}
            onClick={handleIconClick}
            onOpen={handleIconOpen}
          />
        );
      })}
      </div>

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
