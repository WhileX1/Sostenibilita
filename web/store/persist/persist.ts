// Lightweight localStorage persistence — no extra dependency, no PersistGate,
// no rehydration race. The flow is:
//   1. The store boots with the slices' default state on both server and
//      client (so SSR and the first client render produce identical HTML).
//   2. After mount, the client dispatches a `HYDRATE` action carrying any
//      saved state. The store's top-level reducer shallow-merges it in.
//   3. `store.subscribe` fires on every change and writes a debounced
//      snapshot back to localStorage.
//
// `counter` is the boilerplate demo slice and is intentionally NOT persisted.

import {
  WINDOW_DEFINITIONS,
  WINDOW_REGISTRY,
} from "@/lib/windows/registry";
import { MAX_WEIGHT, SCORED_METRICS } from "@/lib/scoring/config";
import {
  autoPosition,
  type IconPosition,
} from "../slices/desktopIconsSlice";

const STORAGE_KEY = "sostenibilita:state";

// Bumped whenever the persisted shape changes incompatibly. A mismatch on
// load drops the saved blob and falls back to defaults — better than
// half-applying state from a previous schema and confusing the UI.
const SCHEMA_VERSION = 1;

// Subset of RootState we care about. Defined structurally to avoid
// importing RootState here (which would create a load-order cycle with
// store.ts).
export interface PersistedState {
  windows: {
    order: string[];
    activeId: string | null;
    maximized: Record<string, true>;
  };
  desktopIcons: {
    byId: Record<string, IconPosition>;
  };
  esg: {
    weights: Record<string, number>;
  };
}

interface Envelope {
  v: number;
  state: PersistedState;
}

const DEFAULT_WEIGHT = Math.round(MAX_WEIGHT / 2);

function isIconPosition(p: unknown): p is IconPosition {
  if (typeof p !== "object" || p === null) return false;
  const q = p as Partial<IconPosition>;
  return (
    (q.side === "left" || q.side === "right") &&
    typeof q.col === "number" &&
    typeof q.row === "number" &&
    Number.isFinite(q.col) &&
    Number.isFinite(q.row) &&
    q.col >= 0 &&
    q.row >= 0
  );
}

// Reconcile a persisted blob with the current registry. Two failure modes
// matter: (a) ids that have since been removed must be dropped (otherwise
// the taskbar/icon grid would render entries with no Component), and
// (b) ids added since the last session must be filled in with defaults
// (otherwise the icon grid would render with holes).
function sanitize(state: PersistedState): PersistedState {
  const knownWindowIds = new Set(Object.keys(WINDOW_REGISTRY));

  const order = state.windows.order.filter((id) => knownWindowIds.has(id));
  const activeId =
    state.windows.activeId && order.includes(state.windows.activeId)
      ? state.windows.activeId
      : null;
  const maximized: Record<string, true> = {};
  for (const id of Object.keys(state.windows.maximized)) {
    if (order.includes(id)) maximized[id] = true;
  }

  // Every registry id must have a position — pick the persisted one if
  // valid, otherwise fall back to autoPosition. This keeps adding a new
  // window to the registry from breaking previously-saved sessions.
  const iconsById: Record<string, IconPosition> = {};
  WINDOW_DEFINITIONS.forEach((def, i) => {
    const persisted = state.desktopIcons.byId?.[def.id];
    iconsById[def.id] = isIconPosition(persisted)
      ? persisted
      : autoPosition(i, WINDOW_DEFINITIONS.length);
  });

  // Same shape recovery for weights: every scored metric gets an entry,
  // either a clamped persisted value or the midpoint default.
  const weights: Record<string, number> = {};
  for (const m of SCORED_METRICS) {
    const v = state.esg.weights?.[m.id];
    weights[m.id] =
      typeof v === "number" && Number.isFinite(v)
        ? Math.max(0, Math.min(MAX_WEIGHT, Math.round(v)))
        : DEFAULT_WEIGHT;
  }

  return {
    windows: { order, activeId, maximized },
    desktopIcons: { byId: iconsById },
    esg: { weights },
  };
}

// Read persisted state from localStorage. Returns null on SSR, on an
// empty / corrupted blob, or on a schema-version mismatch — every failure
// path is silent so a broken localStorage entry can't take the app down.
export function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope | null;
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.state) return null;
    return sanitize(parsed.state);
  } catch {
    return null;
  }
}

// Write the three persisted slices to localStorage. Errors (quota, private
// mode, disabled storage) are swallowed — persistence is best-effort and
// must not break the running app.
export function savePersisted(state: {
  windows: PersistedState["windows"];
  desktopIcons: PersistedState["desktopIcons"];
  esg: PersistedState["esg"];
}): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope = {
      v: SCHEMA_VERSION,
      state: {
        windows: state.windows,
        desktopIcons: state.desktopIcons,
        esg: state.esg,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    /* best-effort */
  }
}

export const HYDRATE = "persist/hydrate" as const;

export interface HydrateAction {
  type: typeof HYDRATE;
  payload: PersistedState;
}

export function hydrate(payload: PersistedState): HydrateAction {
  return { type: HYDRATE, payload };
}
