"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { openWindow } from "@/store/slices/windowsSlice";

// Hook used by each app/<area>/<route>/page.tsx to translate "the URL points
// at this window" into "this window should be open and focused".
//
// Idempotent — the slice's openWindow reducer focuses an already-open window
// instead of duplicating it, so re-mounting (e.g. via fast refresh in dev or
// quick back-then-forward) doesn't drift the cascade index.
export function useOpenWindowOnMount(id: string): void {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(openWindow(id));
  }, [dispatch, id]);
}
