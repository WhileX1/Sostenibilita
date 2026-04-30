"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/lib/themes";

// HH:mm in 24h. Locale-free so the clock width stays predictable across
// rendering environments.
function formatNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Subscribe to the wall clock. First tick lands on the next exact minute
// boundary so the displayed time changes when the user expects it to;
// after that we settle into a 60s cadence.
function subscribe(callback: () => void): () => void {
  const ms = 60_000 - (Date.now() % 60_000);
  let interval: ReturnType<typeof setInterval> | undefined;
  const align = setTimeout(() => {
    callback();
    interval = setInterval(callback, 60_000);
  }, ms);
  return () => {
    clearTimeout(align);
    if (interval) clearInterval(interval);
  };
}

// Empty string on the server avoids a hydration mismatch (server can't know
// the client's local time). The real value is filled in once the store
// subscribes on the client.
const getServerSnapshot = () => "";

export function Clock() {
  const { theme } = useTheme();
  const now = useSyncExternalStore(subscribe, formatNow, getServerSnapshot);
  return (
    <span style={theme.clock.root} aria-label="Current time">
      {now}
    </span>
  );
}
