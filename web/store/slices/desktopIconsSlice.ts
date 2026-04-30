import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { WINDOW_DEFINITIONS } from "@/lib/windows/registry";

// Grid geometry — exported so the Desktop component shares the same cell
// pitch when computing render-time auto-flow on resize. Don't duplicate
// these literals downstream.
export const ICON_COL_WIDTH = 100;
export const ICON_ROW_HEIGHT = 92;
export const ICON_PADDING = 12;
const ICONS_PER_COL = 6;

interface DesktopIconsState {
  byId: Record<string, { x: number; y: number }>;
}

// Default position for the i-th icon — column-flow, ICONS_PER_COL rows
// per column. The 13 entries land as 6 + 6 + 1 across three columns.
function autoPosition(index: number): { x: number; y: number } {
  const col = Math.floor(index / ICONS_PER_COL);
  const row = index % ICONS_PER_COL;
  return {
    x: ICON_PADDING + col * ICON_COL_WIDTH,
    y: ICON_PADDING + row * ICON_ROW_HEIGHT,
  };
}

// Round the dropped pixel position to the nearest grid cell. Negative
// columns/rows are clamped at 0 (icons can't end up off the top-left).
function snapToGrid(x: number, y: number): { x: number; y: number } {
  const col = Math.max(0, Math.round((x - ICON_PADDING) / ICON_COL_WIDTH));
  const row = Math.max(0, Math.round((y - ICON_PADDING) / ICON_ROW_HEIGHT));
  return {
    x: ICON_PADDING + col * ICON_COL_WIDTH,
    y: ICON_PADDING + row * ICON_ROW_HEIGHT,
  };
}

// Initial state seeds every registered window into a unique grid cell.
// Because the seed runs at module load, every id has a position before any
// user interaction — the desktop never needs a "missing id" fallback path.
const initialState: DesktopIconsState = {
  byId: Object.fromEntries(
    WINDOW_DEFINITIONS.map((def, i) => [def.id, autoPosition(i)]),
  ),
};

const slice = createSlice({
  name: "desktopIcons",
  initialState,
  reducers: {
    // Drop a dragged icon. The raw cursor position is snapped to the nearest
    // grid cell; if that cell is already occupied by another icon, the two
    // swap places. This preserves the invariant "at most one icon per cell"
    // without ever rejecting a drop.
    setIconPosition: (
      state,
      action: PayloadAction<{ id: string; x: number; y: number }>,
    ) => {
      const { id, x, y } = action.payload;
      const target = snapToGrid(x, y);
      const previous = state.byId[id];
      // Find any other icon already at the target cell.
      const occupierId = Object.keys(state.byId).find(
        (otherId) =>
          otherId !== id &&
          state.byId[otherId].x === target.x &&
          state.byId[otherId].y === target.y,
      );
      if (occupierId && previous) {
        // Swap: the existing tenant takes the dragged icon's old cell.
        state.byId[occupierId] = previous;
      }
      state.byId[id] = target;
    },

    // Re-seed every icon to its auto-layout slot. Useful for a future
    // "auto arrange" affordance; nothing calls it yet.
    resetIconPositions: (state) => {
      WINDOW_DEFINITIONS.forEach((def, i) => {
        state.byId[def.id] = autoPosition(i);
      });
    },
  },
});

export const { setIconPosition, resetIconPositions } = slice.actions;
export default slice.reducer;
