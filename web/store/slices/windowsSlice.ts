import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface WindowsState {
  // Insertion order. Append on `openWindow` of a new id, splice on
  // `closeWindow`. Drives the taskbar's left-to-right layout. Never mutated
  // by focus changes, so a button keeps its slot as the user shuffles
  // between windows.
  order: string[];
  // The window currently shown in the centered foreground slot. `null`
  // means no window is visible — every id in `order` is still "open" and
  // has a taskbar button, but the desktop is bare.
  activeId: string | null;
  // Sparse map: ids whose user-set state is "fill the desktop" (vs. the
  // default centered 80%). Per-id (not a single flag) so a window
  // remembers its own size when the user shuffles between them.
  maximized: Record<string, true>;
}

const initialState: WindowsState = {
  order: [],
  activeId: null,
  maximized: {},
};

const windowsSlice = createSlice({
  name: "windows",
  initialState,
  reducers: {
    openWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.order.includes(id)) state.order.push(id);
      state.activeId = id;
    },

    closeWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const idx = state.order.indexOf(id);
      if (idx !== -1) state.order.splice(idx, 1);
      delete state.maximized[id];
      if (state.activeId === id) {
        state.activeId = state.order[state.order.length - 1] ?? null;
      }
    },

    focusWindow: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (state.order.includes(id)) state.activeId = id;
    },

    // Send the current foreground window to the background — every id
    // stays in `order`, but no window is rendered until the user picks one
    // from the taskbar (or opens a new one).
    deactivateWindow: (state) => {
      state.activeId = null;
    },

    toggleMaximize: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.order.includes(id)) return;
      if (state.maximized[id]) delete state.maximized[id];
      else state.maximized[id] = true;
    },
  },
});

export const {
  openWindow,
  closeWindow,
  focusWindow,
  deactivateWindow,
  toggleMaximize,
} = windowsSlice.actions;
export default windowsSlice.reducer;
