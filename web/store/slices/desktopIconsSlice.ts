import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { DESKTOP_ITEMS } from "@/lib/windows/registry";

// Grid geometry — exported so the Desktop component shares the same cell
// pitch when computing render-time auto-flow on resize. Don't duplicate
// these literals downstream.
export const ICON_COL_WIDTH = 100;
// Pitch = button height (88, see `desktopIcon.ts` root) + ~12px breathing
// gap. Keeping the gap consistent across rows is what makes the column
// look uniform; before the button got a locked height, 1-line labels
// produced a ~25px visible gap and 2-line labels a ~9px one.
export const ICON_ROW_HEIGHT = 100;
export const ICON_PADDING = 12;

export type IconSide = "left" | "right";

// Stored position. Side-anchored — column 0 is the column closest to the
// chosen edge, column 1 is one cell inward, etc. This keeps icons pinned
// to the edges as the desktop resizes (and keeps them from being hidden
// behind a centered 80% window).
export interface IconPosition {
  side: IconSide;
  col: number;
  row: number;
}

interface DesktopIconsState {
  byId: Record<string, IconPosition>;
}

// Default seed: split icons roughly half-and-half between the left and
// right edges, single column on each side, top-down by `DESKTOP_ITEMS`
// order. Exported so the persistence sanitizer can fall back to a
// default cell for any desktop id that wasn't present in the previous
// session. `total` is the number of icons being seeded — currently
// `DESKTOP_ITEMS.length` (3 area folders + 3 Objective entries).
export function autoPosition(index: number, total: number): IconPosition {
  const halfPoint = Math.ceil(total / 2);
  const isLeft = index < halfPoint;
  return {
    side: isLeft ? "left" : "right",
    col: 0,
    row: isLeft ? index : index - halfPoint,
  };
}

// Render the stored side-anchored cell as absolute pixels inside a parent
// of the given width. Exported so the Desktop component can compute the
// drag-start snapshot in the same coordinate system the renderer uses.
export function iconPixelOf(
  pos: IconPosition,
  parentWidth: number,
): { x: number; y: number } {
  const x =
    pos.side === "left"
      ? ICON_PADDING + pos.col * ICON_COL_WIDTH
      : parentWidth - ICON_PADDING - ICON_COL_WIDTH - pos.col * ICON_COL_WIDTH;
  const y = ICON_PADDING + pos.row * ICON_ROW_HEIGHT;
  return { x, y };
}

// Round a dropped pixel position to the nearest grid cell on whichever
// side is closer. The icon's center is what decides side (so a drop that
// straddles the midline goes to whichever half the icon is *more* in).
// Negative cols/rows are clamped at 0 (icons can't end up off-screen);
// `col` is also capped at `maxColsPerSide − 1` so a drop near the middle
// of a narrow desktop can't land in a column that would visually
// overlap with the opposite side. (Same overlap math as the resolver in
// `Desktop.tsx`: each side gets at most `floor((W − 2·pad) / (2·W_cell))`
// columns.)
function snapToGrid(
  x: number,
  y: number,
  parentWidth: number,
): IconPosition {
  const center = x + ICON_COL_WIDTH / 2;
  const isLeft = center < parentWidth / 2;
  const maxColsPerSide = Math.max(
    1,
    Math.floor((parentWidth - 2 * ICON_PADDING) / (2 * ICON_COL_WIDTH)),
  );
  const rawCol = isLeft
    ? Math.round((x - ICON_PADDING) / ICON_COL_WIDTH)
    : Math.round(
        (parentWidth - ICON_PADDING - ICON_COL_WIDTH - x) / ICON_COL_WIDTH,
      );
  const col = Math.max(0, Math.min(maxColsPerSide - 1, rawCol));
  const row = Math.max(0, Math.round((y - ICON_PADDING) / ICON_ROW_HEIGHT));
  return { side: isLeft ? "left" : "right", col, row };
}

const initialState: DesktopIconsState = {
  byId: Object.fromEntries(
    DESKTOP_ITEMS.map((def, i) => [
      def.id,
      autoPosition(i, DESKTOP_ITEMS.length),
    ]),
  ),
};

const slice = createSlice({
  name: "desktopIcons",
  initialState,
  reducers: {
    // Drop a dragged icon. The raw cursor position is snapped to the nearest
    // grid cell on whichever side is closer; if that cell is already
    // occupied, the two icons swap places. `parentWidth` is supplied by the
    // caller (the slice doesn't know the desktop's measured width on its
    // own), and is required to map a right-side drop back into a stable
    // (col, row) anchored to the right edge.
    setIconPosition: (
      state,
      action: PayloadAction<{
        id: string;
        x: number;
        y: number;
        parentWidth: number;
      }>,
    ) => {
      const { id, x, y, parentWidth } = action.payload;
      const target = snapToGrid(x, y, parentWidth);
      const previous = state.byId[id];
      const occupierId = Object.keys(state.byId).find((otherId) => {
        if (otherId === id) return false;
        const p = state.byId[otherId];
        return (
          p.side === target.side &&
          p.col === target.col &&
          p.row === target.row
        );
      });
      if (occupierId && previous) {
        state.byId[occupierId] = previous;
      }
      state.byId[id] = target;
    },

    // Re-seed every icon to its auto-layout slot. Useful for a future
    // "auto arrange" affordance; nothing calls it yet.
    resetIconPositions: (state) => {
      DESKTOP_ITEMS.forEach((def, i) => {
        state.byId[def.id] = autoPosition(i, DESKTOP_ITEMS.length);
      });
    },
  },
});

export const { setIconPosition, resetIconPositions } = slice.actions;
export default slice.reducer;
