"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { hydrate, loadPersisted } from "./persist/persist";

export function Providers({ children }: { children: React.ReactNode }) {
  // Rehydrate from localStorage after mount, not synchronously. The first
  // server + client render must produce the same HTML (same default state)
  // to avoid a hydration mismatch — `localStorage` is client-only, so any
  // pre-rendered state read from it would diverge. Dispatching HYDRATE in
  // an effect runs strictly after hydration, then triggers a re-render
  // with the saved state. The cost is one frame of "default desktop"
  // before the persisted layout shows, which is acceptable for a UI that
  // also lazy-loads its window content.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) store.dispatch(hydrate(persisted));
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
