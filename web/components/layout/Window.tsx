"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch } from "@/store/hooks";
import {
  closeWindow,
  focusWindow,
  minimizeWindow,
  setWindowBounds,
  toggleMaximize,
} from "@/store/slices/windowsSlice";
import { getWindow } from "@/lib/windows/registry";

const MIN_WIDTH = 240;
const MIN_HEIGHT = 160;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isActive: boolean;
  isMaximized: boolean;
  zIndex: number;
}

// Apply a resize delta in a given direction to a starting bounds box.
// Enforces MIN_WIDTH / MIN_HEIGHT by adjusting the *opposite* edge — so
// dragging the west handle past the min stops the box at MIN_WIDTH instead
// of letting x run away.
function applyResize(dir: ResizeDir, dx: number, dy: number, init: Bounds): Bounds {
  let { x, y, width, height } = init;
  if (dir.includes("e")) {
    width = Math.max(MIN_WIDTH, init.width + dx);
  }
  if (dir.includes("w")) {
    width = Math.max(MIN_WIDTH, init.width - dx);
    x = init.x + (init.width - width);
  }
  if (dir.includes("s")) {
    height = Math.max(MIN_HEIGHT, init.height + dy);
  }
  if (dir.includes("n")) {
    height = Math.max(MIN_HEIGHT, init.height - dy);
    y = init.y + (init.height - height);
  }
  return { x, y, width, height };
}

// Clamp a bounds box so it stays inside the parent's content area.
function clampToParent(b: Bounds, parentW: number, parentH: number): Bounds {
  let { x, y, width, height } = b;
  if (x < 0) { width += x; x = 0; }
  if (y < 0) { height += y; y = 0; }
  if (x + width > parentW) width = parentW - x;
  if (y + height > parentH) height = parentH - y;
  // Re-enforce min after parent clamp — a too-small parent loses min, but
  // that's fine; the window collapses to fit.
  width = Math.max(MIN_WIDTH, width);
  height = Math.max(MIN_HEIGHT, height);
  return { x, y, width, height };
}

// Inline SVG glyphs for the title-bar buttons. Drawn at the same 10×10 grid
// so visual weight matches; stroke-width 1.5 reads cleanly at 14px tall.
function MinimizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <rect x="2" y="7" width="6" height="2" fill="#000" />
    </svg>
  );
}
function MaximizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <rect x="1" y="1" width="8" height="8" fill="none" stroke="#000" strokeWidth="1.5" />
      <rect x="1" y="1" width="8" height="2" fill="#000" />
    </svg>
  );
}
function RestoreGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <rect x="1" y="3" width="6" height="6" fill="#fff" stroke="#000" strokeWidth="1.2" />
      <rect x="3" y="1" width="6" height="6" fill="#fff" stroke="#000" strokeWidth="1.2" />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <line x1="2" y1="2" x2="8" y2="8" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="8" x2="8" y2="2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Window({
  id,
  x,
  y,
  width,
  height,
  isActive,
  isMaximized,
  zIndex,
}: WindowProps) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const def = getWindow(id);

  const rootRef = useRef<HTMLDivElement>(null);

  // Live geometry while a drag/resize is in flight. Both are non-null only
  // during interaction; on mouseup we dispatch the final value and clear.
  // Keeping interaction state local (vs. dispatching every mousemove) avoids
  // 60fps Redux churn during drag.
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [resize, setResize] = useState<Bounds | null>(null);

  const [closePressed, setClosePressed] = useState(false);
  const [minPressed, setMinPressed] = useState(false);
  const [maxPressed, setMaxPressed] = useState(false);

  // While resizing, force the document cursor to match the handle's cursor
  // — otherwise the moment the mouse leaves the 4px-wide handle strip the
  // cursor reverts to default and the resize "feels broken".
  const [activeResizeDir, setActiveResizeDir] = useState<ResizeDir | null>(null);
  useEffect(() => {
    if (!activeResizeDir) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = `${activeResizeDir}-resize`;
    return () => {
      document.body.style.cursor = prev;
    };
  }, [activeResizeDir]);

  if (!def) return null;
  const Content = def.Component;

  const handleFocus = () => {
    if (!isActive) dispatch(focusWindow(id));
  };

  const handleClose = () => {
    dispatch(closeWindow(id));
    if (pathname === def.route) router.replace("/");
  };

  // ── Drag (title-bar) ───────────────────────────────────────────────
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return; // dragging a maximized window is a no-op
    if (e.button !== 0) return;
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!root || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = x;
    const initialY = y;
    // Suppress text selection across the page during the drag — otherwise
    // sweeping over chrome (taskbar, topbar) would highlight their labels.
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nx = initialX + dx;
      let ny = initialY + dy;
      // Clamp so the window stays inside the desktop area.
      nx = Math.max(0, Math.min(parentRect.width - width, nx));
      ny = Math.max(0, Math.min(parentRect.height - height, ny));
      setDrag({ x: nx, y: ny });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = previousUserSelect;
      setDrag((current) => {
        if (current) {
          dispatch(setWindowBounds({ id, x: current.x, y: current.y }));
        }
        return null;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    handleFocus();
  };

  // ── Resize (8 handles) ─────────────────────────────────────────────
  // Single non-curried handler so the lint rule about reading refs during
  // render is satisfied — the curried `(dir) => (e) => …` form was being
  // misread as if `rootRef.current` could be touched at the JSX-prop call.
  const handleResizeMouseDown = (e: React.MouseEvent, dir: ResizeDir) => {
    if (isMaximized) return;
    if (e.button !== 0) return;
    e.stopPropagation(); // don't also trigger drag via the root mousedown
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!root || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const init: Bounds = { x, y, width, height };
    setActiveResizeDir(dir);
    // Suppress text selection across the page during the resize.
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const next = clampToParent(
        applyResize(dir, dx, dy, init),
        parentRect.width,
        parentRect.height,
      );
      setResize(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = previousUserSelect;
      setActiveResizeDir(null);
      setResize((current) => {
        if (current) dispatch(setWindowBounds({ id, ...current }));
        return null;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    handleFocus();
  };

  // Resolve the geometry that actually goes into the DOM. Maximized wins
  // over interaction state (we early-return on isMaximized in the handlers,
  // but be defensive). Resize wins over drag wins over base.
  let liveStyle: CSSProperties;
  if (isMaximized) {
    liveStyle = { ...theme.window.root, inset: 0, zIndex };
  } else {
    const live = resize ?? (drag ? { x: drag.x, y: drag.y, width, height } : { x, y, width, height });
    liveStyle = {
      ...theme.window.root,
      left: live.x,
      top: live.y,
      width: live.width,
      height: live.height,
      zIndex,
    };
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={def.title}
      onMouseDown={handleFocus}
      style={liveStyle}
    >
      <div
        onMouseDown={handleTitleMouseDown}
        onDoubleClick={() => dispatch(toggleMaximize(id))}
        style={{
          ...theme.window.titleBar,
          ...(isActive ? theme.window.titleBarActive : null),
        }}
      >
        <span style={theme.window.titleBarText}>{def.title}</span>
        <span style={theme.window.buttonGroup}>
          <button
            type="button"
            aria-label="Minimize"
            onMouseDown={(e) => {
              e.stopPropagation();
              setMinPressed(true);
            }}
            onMouseUp={() => setMinPressed(false)}
            onMouseLeave={() => setMinPressed(false)}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(minimizeWindow(id));
            }}
            style={{
              ...theme.window.iconButton,
              ...(minPressed ? theme.window.iconButtonPressed : null),
            }}
          >
            <MinimizeGlyph />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? "Restore" : "Maximize"}
            onMouseDown={(e) => {
              e.stopPropagation();
              setMaxPressed(true);
            }}
            onMouseUp={() => setMaxPressed(false)}
            onMouseLeave={() => setMaxPressed(false)}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(toggleMaximize(id));
            }}
            style={{
              ...theme.window.iconButton,
              ...(maxPressed ? theme.window.iconButtonPressed : null),
            }}
          >
            {isMaximized ? <RestoreGlyph /> : <MaximizeGlyph />}
          </button>
          <button
            type="button"
            aria-label="Close"
            onMouseDown={(e) => {
              e.stopPropagation();
              setClosePressed(true);
            }}
            onMouseUp={() => setClosePressed(false)}
            onMouseLeave={() => setClosePressed(false)}
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            style={{
              ...theme.window.iconButton,
              ...(closePressed ? theme.window.iconButtonPressed : null),
            }}
          >
            <CloseGlyph />
          </button>
        </span>
      </div>
      <div style={theme.window.body}>
        <Suspense fallback={<p>Loading…</p>}>
          <Content />
        </Suspense>
      </div>

      {/* Resize handles — only rendered when the window is in its normal
          (non-maximized) state. Edges first, corners last so corner cursors
          win on stacking. */}
      {!isMaximized && (
        <>
          <span style={theme.window.resizeEdgeN} onMouseDown={(e) => handleResizeMouseDown(e, "n")} />
          <span style={theme.window.resizeEdgeS} onMouseDown={(e) => handleResizeMouseDown(e, "s")} />
          <span style={theme.window.resizeEdgeE} onMouseDown={(e) => handleResizeMouseDown(e, "e")} />
          <span style={theme.window.resizeEdgeW} onMouseDown={(e) => handleResizeMouseDown(e, "w")} />
          <span style={theme.window.resizeCornerNE} onMouseDown={(e) => handleResizeMouseDown(e, "ne")} />
          <span style={theme.window.resizeCornerNW} onMouseDown={(e) => handleResizeMouseDown(e, "nw")} />
          <span style={theme.window.resizeCornerSE} onMouseDown={(e) => handleResizeMouseDown(e, "se")} />
          <span style={theme.window.resizeCornerSW} onMouseDown={(e) => handleResizeMouseDown(e, "sw")} />
        </>
      )}
    </div>
  );
}
