"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { hydrate, loadPersisted } from "./persist/persist";

// Whether the post-mount HYDRATE effect has run. Components that would
// otherwise paint at default state on first render then snap to the
// persisted layout (the desktop icon grid is the visible offender) read
// this flag to suppress paint until the persisted state has been merged
// in. Defaults to false so SSR and the first client render agree.
const HydratedContext = createContext(false);

export function useHydrated(): boolean {
  return useContext(HydratedContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Rehydrate from localStorage after mount, not synchronously. The first
  // server + client render must produce the same HTML (same default state)
  // to avoid a hydration mismatch — `localStorage` is client-only, so any
  // pre-rendered state read from it would diverge. Dispatching HYDRATE in
  // an effect runs strictly after hydration, then triggers a re-render
  // with the saved state.
  //
  // The `hydrated` flag is flipped to true *after* the dispatch (or after
  // confirming there is nothing persisted), so consumers can suppress the
  // pre-hydrate paint and avoid the visible "icons reposition" flash.
  // Always set to true even when `loadPersisted` returns null — first-time
  // visitors must still see the default icons.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) store.dispatch(hydrate(persisted));
    // One-shot sync with a non-React system (localStorage). The
    // `set-state-in-effect` rule flags any setState in an effect, but
    // the React docs explicitly allow it for "interactions with non-
    // React systems" — exactly what HYDRATE is.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  return (
    <Provider store={store}>
      <HydratedContext.Provider value={hydrated}>
        {children}
      </HydratedContext.Provider>
    </Provider>
  );
}
