import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// One open window's runtime state. `zIndex` is per-window so that focus
// changes don't have to touch the `order` array — the taskbar reads `order`
// (insertion order) and stays stable while focus shuffles z-stacks.
export interface WindowInstance {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  // Saved geometry to restore to on un-maximize. While `isMaximized` is true,
  // the renderer ignores x/y/width/height and uses the desktop's bounds; we
  // never overwrite them so the user gets back exactly what they had.
  restoreBounds: { x: number; y: number; width: number; height: number } | null;
  // Painting order. Higher = closer to the user. Updated by `bumpZ` on
  // every focus change; never decreases. Two windows can't share a value
  // because we always assign `state.nextZIndex++`.
  zIndex: number;
}

interface WindowsState {
  byId: Record<string, WindowInstance>;
  // **Insertion order** — drives the taskbar. Append on open, splice on
  // close. *Never* mutated on focus, so taskbar buttons don't reshuffle as
  // the user switches windows.
  order: string[];
  // The window with focus. When it's minimized, its taskbar button still
  // displays the active indicator (Win2K behavior).
  activeId: string | null;
  // Monotonically increasing — assigned to a window's `zIndex` whenever it
  // becomes topmost. Doesn't reset on close so we never collide with a
  // previously-issued value.
  nextZIndex: number;
  // Monotonically increasing — index used for cascade positioning. Wraps via
  // modulo at allocation time so we don't reset when a window closes.
  nextCascadeIndex: number;
}

const CASCADE_BASE_X = 48;
const CASCADE_BASE_Y = 48;
const CASCADE_STEP = 28;
const CASCADE_WRAP = 8;
const DEFAULT_WIDTH = 680;
const DEFAULT_HEIGHT = 440;

const initialState: WindowsState = {
  byId: {},
  order: [],
  activeId: null,
  nextZIndex: 1,
  nextCascadeIndex: 0,
};

// Promote a window to the top of the z-stack and mark it active. Does not
// mutate `order` — that's the whole point of separating the two concepts.
function bumpZ(state: WindowsState, id: string) {
  const win = state.byId[id];
  if (!win) return;
  win.zIndex = state.nextZIndex;
  state.nextZIndex += 1;
  state.activeId = id;
}

// Pick the topmost non-minimized window by zIndex — used when the active
// window is being minimized or closed and we need to transfer focus.
function topmostNonMinimized(state: WindowsState, exclude?: string): string | null {
  let bestId: string | null = null;
  let bestZ = -Infinity;
  for (const id of Object.keys(state.byId)) {
    if (id === exclude) continue;
    const w = state.byId[id];
    if (w.isMinimized) continue;
    if (w.zIndex > bestZ) {
      bestZ = w.zIndex;
      bestId = id;
    }
  }
  return bestId;
}

const windowsSlice = createSlice({
  name: "windows",
  initialState,
  reducers: {
    openWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const existing = state.byId[id];
      if (existing) {
        // Already open — un-minimize if needed, then bump to top.
        if (existing.isMinimized) existing.isMinimized = false;
        bumpZ(state, id);
        return;
      }
      const i = state.nextCascadeIndex % CASCADE_WRAP;
      state.byId[id] = {
        id,
        x: CASCADE_BASE_X + CASCADE_STEP * i,
        y: CASCADE_BASE_Y + CASCADE_STEP * i,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        isMinimized: false,
        isMaximized: false,
        restoreBounds: null,
        zIndex: state.nextZIndex,
      };
      state.nextZIndex += 1;
      state.order.push(id);
      state.activeId = id;
      state.nextCascadeIndex += 1;
    },

    closeWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.byId[id];
      const idx = state.order.indexOf(id);
      if (idx !== -1) state.order.splice(idx, 1);
      if (state.activeId === id) {
        state.activeId =
          topmostNonMinimized(state) ?? state.order[state.order.length - 1] ?? null;
      }
    },

    focusWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.byId[id]) return;
      bumpZ(state, id);
    },

    minimizeWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const win = state.byId[id];
      if (!win || win.isMinimized) return;
      win.isMinimized = true;
      // Transfer focus to the next-topmost non-minimized window.
      if (state.activeId === id) {
        state.activeId = topmostNonMinimized(state, id);
      }
    },

    restoreWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const win = state.byId[id];
      if (!win) return;
      win.isMinimized = false;
      bumpZ(state, id);
    },

    toggleMaximize: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const win = state.byId[id];
      if (!win) return;
      if (win.isMaximized) {
        if (win.restoreBounds) {
          win.x = win.restoreBounds.x;
          win.y = win.restoreBounds.y;
          win.width = win.restoreBounds.width;
          win.height = win.restoreBounds.height;
        }
        win.isMaximized = false;
        win.restoreBounds = null;
      } else {
        // Snapshot current bounds for the future restore.
        win.restoreBounds = { x: win.x, y: win.y, width: win.width, height: win.height };
        win.isMaximized = true;
      }
      bumpZ(state, id);
    },

    // Used by both drag (only x/y change) and resize (any combination).
    // Maximized windows ignore bounds writes — moving/resizing them is a UI
    // no-op; the consumer should drop out of maximize first if needed.
    setWindowBounds: (
      state,
      action: PayloadAction<{
        id: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      }>,
    ) => {
      const { id, x, y, width, height } = action.payload;
      const win = state.byId[id];
      if (!win || win.isMaximized) return;
      if (x !== undefined) win.x = x;
      if (y !== undefined) win.y = y;
      if (width !== undefined) win.width = width;
      if (height !== undefined) win.height = height;
    },
  },
});

export const {
  openWindow,
  closeWindow,
  focusWindow,
  minimizeWindow,
  restoreWindow,
  toggleMaximize,
  setWindowBounds,
} = windowsSlice.actions;
export default windowsSlice.reducer;
