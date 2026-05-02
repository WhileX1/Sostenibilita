import {
  combineReducers,
  configureStore,
  type Action,
} from "@reduxjs/toolkit";
import counterReducer from "./slices/counterSlice";
import windowsReducer from "./slices/windowsSlice";
import desktopIconsReducer from "./slices/desktopIconsSlice";
import esgReducer from "./slices/esgSlice";
import metricsReducer from "./slices/metricsSlice";
import {
  HYDRATE,
  savePersisted,
  type HydrateAction,
} from "./persist/persist";

const rootReducer = combineReducers({
  counter: counterReducer,
  windows: windowsReducer,
  desktopIcons: desktopIconsReducer,
  esg: esgReducer,
  metrics: metricsReducer,
});

type RawState = ReturnType<typeof rootReducer>;

// Top-level shim: a HYDRATE action overlays the persisted slices on top
// of the current state. Slices stay free of persistence awareness — the
// merge logic lives here.
//
// `windows` is *merged* rather than replaced because a deep-link route's
// `useOpenWindowOnMount` effect dispatches `openWindow` from the leaves
// before the Providers-level hydrate effect fires (React runs child
// effects before parent effects). A naive replace would wipe out the
// deep-linked window. Concretely:
//   - order: union (persisted first, then any current ids not in
//     persisted) so the deep-linked id is appended without losing the
//     previous-session ordering.
//   - activeId: the deep-link wins; if there is none, fall back to
//     persisted.
//   - maximized: union; current keys override persisted on conflict.
//
// `desktopIcons`, `esg`, and `metrics` get a clean replace — nothing
// dispatches into them before hydrate, so there is no concurrent state to
// preserve.
function appReducer(state: RawState | undefined, action: Action): RawState {
  if (action.type === HYDRATE) {
    const base = state ?? rootReducer(undefined, action);
    const { payload } = action as HydrateAction;

    const orderUnion = [
      ...payload.windows.order,
      ...base.windows.order.filter(
        (id) => !payload.windows.order.includes(id),
      ),
    ];
    const candidateActive =
      base.windows.activeId ?? payload.windows.activeId;
    const activeId =
      candidateActive && orderUnion.includes(candidateActive)
        ? candidateActive
        : null;

    return {
      ...base,
      windows: {
        order: orderUnion,
        activeId,
        maximized: { ...payload.windows.maximized, ...base.windows.maximized },
      },
      desktopIcons: payload.desktopIcons,
      esg: payload.esg,
      metrics: payload.metrics,
    };
  }
  return rootReducer(state, action);
}

export const store = configureStore({
  reducer: appReducer,
});

// Save on every state change, debounced. Slider drags fire many rapid
// dispatches; serialising + writing on every one would be wasteful and on
// some browsers (Safari private mode, low-storage devices) noticeably
// slow. 300ms is short enough that a refresh right after an interaction
// still picks up the latest state in practice.
if (typeof window !== "undefined") {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  store.subscribe(() => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const s = store.getState();
      savePersisted({
        windows: s.windows,
        desktopIcons: s.desktopIcons,
        esg: s.esg,
        metrics: s.metrics,
      });
      saveTimer = null;
    }, 300);
  });
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
