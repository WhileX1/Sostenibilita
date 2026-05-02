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
import {
  defaultMetricsState,
  defaultValueFor,
  type InputDefinition,
  type InputType,
  type MetricConfig,
} from "../slices/metricsSlice";
import type { Value } from "@/lib/formula";

const STORAGE_KEY = "sostenibilita:state";

// Bumped whenever the persisted shape changes incompatibly. A version we
// know how to migrate is upgraded in `loadPersisted`; an unknown version
// is dropped and replaced by defaults — better than half-applying state
// from an unfamiliar schema and confusing the UI.
const SCHEMA_VERSION = 2;

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
  metrics: {
    byId: Record<string, MetricConfig>;
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

function isInputType(t: unknown): t is InputType {
  return t === "number" || t === "boolean" || t === "string";
}

function isInputDefinition(p: unknown): p is InputDefinition {
  if (typeof p !== "object" || p === null) return false;
  const q = p as Partial<InputDefinition>;
  if (typeof q.name !== "string" || q.name.length === 0) return false;
  if (!isInputType(q.type)) return false;
  if (q.label !== undefined && typeof q.label !== "string") return false;
  return true;
}

function isMetricConfig(p: unknown): p is MetricConfig {
  if (typeof p !== "object" || p === null) return false;
  const q = p as Partial<MetricConfig>;
  if (typeof q.formula !== "string") return false;
  if (!Array.isArray(q.inputs)) return false;
  if (!q.inputs.every(isInputDefinition)) return false;
  // `values` must be an object — individual entries are reconciled in
  // `reconcileMetric` below (missing entries get defaults, type
  // mismatches reset). Don't reject the whole metric just because one
  // value drifted — that would lose the user's whole formula.
  if (typeof q.values !== "object" || q.values === null) return false;
  return true;
}

function valueMatchesType(v: unknown, type: InputType): v is Value {
  if (type === "number") return typeof v === "number" && Number.isFinite(v);
  if (type === "boolean") return typeof v === "boolean";
  return typeof v === "string";
}

// Drop value entries for inputs that no longer exist, fill in missing
// values with the per-type default, and reset values whose type no
// longer matches their input definition. The result has the invariant
// `Object.keys(values) === inputs.map(i => i.name)` that the slice
// reducers maintain at runtime.
function reconcileValues(persisted: MetricConfig): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const inp of persisted.inputs) {
    const v = persisted.values[inp.name];
    out[inp.name] = valueMatchesType(v, inp.type) ? v : defaultValueFor(inp.type);
  }
  return out;
}

// Per-variable slider weights. The map's keys are identifier names
// (strings — any valid DSL identifier) and values are integer raw
// weights; we keep stale keys (variables that no longer appear in the
// formula's `score = …`) so a temporary edit doesn't wipe out a user's
// chosen weight. Anything that isn't a finite number is dropped — the
// UI then falls back to the default weight.
function reconcileWeights(persisted: unknown): Record<string, number> {
  if (typeof persisted !== "object" || persisted === null) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(persisted as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[k] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return out;
}

// Per-variable [min, max] judgement ranges. Same rule as weights: stale
// keys are kept (a temporary formula edit shouldn't wipe range choices),
// malformed entries are dropped silently. Range objects must have both
// `min` and `max` as finite numbers; missing/typo'd halves drop the entry.
function reconcileRanges(
  persisted: unknown,
): Record<string, { min: number; max: number }> {
  if (typeof persisted !== "object" || persisted === null) return {};
  const out: Record<string, { min: number; max: number }> = {};
  for (const [k, v] of Object.entries(persisted as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as { min?: unknown; max?: unknown };
    if (typeof r.min !== "number" || !Number.isFinite(r.min)) continue;
    if (typeof r.max !== "number" || !Number.isFinite(r.max)) continue;
    out[k] = { min: r.min, max: r.max };
  }
  return out;
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
    const v = state.esg?.weights?.[m.id];
    weights[m.id] =
      typeof v === "number" && Number.isFinite(v)
        ? Math.max(0, Math.min(MAX_WEIGHT, Math.round(v)))
        : DEFAULT_WEIGHT;
  }

  // Same recovery for metric configs: every scored id gets an entry. A
  // persisted entry that no longer matches the runtime shape falls back
  // to the factory seed for that metric. A valid persisted entry still
  // has its `values` reconciled — orphan keys dropped, missing keys
  // filled, type-mismatched values reset — so the slice's runtime
  // invariant (values keys === input names) holds even after migration.
  const factoryMetrics = defaultMetricsState();
  const metricsById: Record<string, MetricConfig> = {};
  for (const m of SCORED_METRICS) {
    const persisted = state.metrics?.byId?.[m.id];
    if (isMetricConfig(persisted)) {
      // `isMaterial` was added after the v2 shape — older blobs lack
      // the field. Default to `true` so existing assessments keep
      // contributing to the rating; the user can flip the switch
      // explicitly if they want a topic re-categorised. The reason is
      // only kept when the metric is actually flagged not material.
      const isMaterial =
        typeof (persisted as Partial<MetricConfig>).isMaterial === "boolean"
          ? (persisted as MetricConfig).isMaterial
          : true;
      const reasonRaw = (persisted as Partial<MetricConfig>)
        .notMaterialReason;
      const notMaterialReason =
        !isMaterial && typeof reasonRaw === "string" ? reasonRaw : undefined;
      metricsById[m.id] = {
        isMaterial,
        notMaterialReason,
        inputs: persisted.inputs,
        formula: persisted.formula,
        values: reconcileValues(persisted),
        // `weights` and `ranges` were added after the v2 schema bump;
        // older blobs simply lack the keys. The reconcile helpers
        // tolerate missing / malformed input by returning {}, so the
        // user's other metric data isn't lost when they upgrade in
        // place.
        weights: reconcileWeights(
          (persisted as Partial<MetricConfig>).weights,
        ),
        ranges: reconcileRanges(
          (persisted as Partial<MetricConfig>).ranges,
        ),
      };
    } else {
      metricsById[m.id] = factoryMetrics.byId[m.id];
    }
  }

  return {
    windows: { order, activeId, maximized },
    desktopIcons: { byId: iconsById },
    esg: { weights },
    metrics: { byId: metricsById },
  };
}

// Read persisted state from localStorage. Returns null on SSR, on an
// empty / corrupted blob, or on an unrecognised schema version — every
// failure path is silent so a broken localStorage entry can't take the
// app down.
//
// Migrations between known schema versions are handled by passing the
// older blob through `sanitize`: the sanitizer reads each field with
// optional chains and falls back to factory defaults when something is
// missing or malformed, so v1 blobs (no `metrics`) load cleanly into a v2
// shape without losing the user's window state, icon positions, or
// weights.
const KNOWN_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([1, SCHEMA_VERSION]);

export function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope | null;
    if (!parsed || !parsed.state) return null;
    if (!KNOWN_SCHEMA_VERSIONS.has(parsed.v)) return null;
    return sanitize(parsed.state);
  } catch {
    return null;
  }
}

// Write the four persisted slices to localStorage. Errors (quota, private
// mode, disabled storage) are swallowed — persistence is best-effort and
// must not break the running app.
export function savePersisted(state: {
  windows: PersistedState["windows"];
  desktopIcons: PersistedState["desktopIcons"];
  esg: PersistedState["esg"];
  metrics: PersistedState["metrics"];
}): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope = {
      v: SCHEMA_VERSION,
      state: {
        windows: state.windows,
        desktopIcons: state.desktopIcons,
        esg: state.esg,
        metrics: state.metrics,
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
