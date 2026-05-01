# ESG Scoring

The Strategy / Rating ESG / Reporting CSRD windows together implement a small *materiality-weighted ESG scoring* model: the user weights how much each of 10 metrics matters to them, then provides input data, then sees a 0-100 ESG score normalised against those weights. v1 covers only the **weights** half — input forms and the score itself land in later passes.

## Pieces

| Layer            | Role                                                                                   | Lives in                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Scoring config   | The list of scored metrics + the weight cap. Pure data, no React, no Redux.            | [`web/lib/scoring/config.ts`](../../lib/scoring/config.ts)                               |
| Redux slice      | Source of truth for per-metric weights (and, later, per-metric inputs).                | [`web/store/slices/esgSlice.ts`](../../store/slices/esgSlice.ts)                         |
| Strategy UI      | Per-metric slider + live-normalised share %. The page where weights are edited.        | [`web/components/pages/objective/Strategy.tsx`](../../components/pages/objective/Strategy.tsx) |

## Which metrics are scored

Each registry entry that contributes to the ESG score is flagged with `scored: true`. The 10 E/S/G windows are flagged; the 3 Objective windows (Reporting CSRD, Rating ESG, Strategy) are not — they're *outputs* and *configuration of the system itself*, not measurable inputs.

```ts
export const SCORED_METRICS: WindowDefinition[] = WINDOW_DEFINITIONS.filter(
  (w) => w.scored === true,
);
```

The flag is explicit on purpose: a future Objective window could opt into scoring by setting `scored: true` on its registry entry, without needing to move it to a different area (areas are a UI grouping for the Start menu, not a scoring concept). Symmetrically, a non-scored helper window in E/S/G is also possible just by leaving the flag off.

## Materiality weights

Every scored metric has an integer weight in `[0, MAX_WEIGHT]` where `MAX_WEIGHT = 10`. The default is the **midpoint** (5/10), so every metric counts equally on first load and the user moves sliders up or down to express which metrics matter more or less for their organisation.

### Why midpoint, not max

Max would also produce an "all equal" baseline — but a max baseline only allows the user to *down-weight* a metric (sliders only move down). Midpoint preserves both directions, which matches the mental model of "raise the ones that matter, lower the ones that don't".

### Why a flat 0-10, not per-metric maxes

A draft of this design had per-metric max weights tuned to typical ESG materiality (CO₂ at 30, water at 8, etc.). Rejected: it bakes a single sector's materiality into the system, when materiality varies by industry. The flat 0-10 is *sector-agnostic*; the user expresses materiality themselves by moving the sliders.

## State shape

```ts
interface EsgState {
  // Materiality weight per metric, integer in [0, MAX_WEIGHT]. Default is
  // the midpoint for every metric — neutral start where everything counts
  // equally and the user can move sliders either up or down to express
  // materiality.
  weights: Record<string, number>;
}
```

Defaults are seeded at module load by `defaultWeights()`, which iterates `SCORED_METRICS` and assigns `Math.round(MAX_WEIGHT / 2)` to each. The slice's `setWeight` reducer clamps any incoming value to the valid range.

## Reducer actions

| Action                              | Effect                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `setWeight({ id, weight })`         | Set `weights[id]` to the value, rounded and clamped to `[0, MAX_WEIGHT]`. No-op if the id isn't a known metric. |
| `resetWeights()`                    | Re-seed every weight to the midpoint default.                                                 |

## Strategy page

The Strategy window iterates the three scored areas (Environmental / Social / Governance), groups metrics by area into a `<fieldset>`, and renders one row per metric:

```
[ Metric name ]  [────●────slider────]  [ 5/10 ]  [ 10.0% ]
```

The share column is `weight / Σweights × 100`, recomputed on every render. As the user moves a slider, every other metric's share updates in real time — shares always sum to 100% regardless of where the raw weights sit. This is the **live-normalisation** model: the user sees the consequence of every adjustment without having to manually rebalance.

The footer pairs *Reset to defaults* (left) with the raw total `Σweights / (SCORED_METRICS.length × MAX_WEIGHT)` (right). The raw total is purely informational — score computation reads `weights` and normalises on demand, not the running total.

## What v1 does not do

- **No input data, no score.** Each metric's window is still a placeholder. The intended next step: each window gets a small form (e.g. kWh/year + % renewables for Energy), a per-metric `score()` function in `web/lib/scoring/score.ts` returns `0..100`, and an `aggregate()` combines them into per-area and total ESG scores using the weights from this slice.
- **No persistence across reloads.** Reloading resets every weight to the midpoint default. Same constraint as the window manager (see [`window-manager.md`](window-manager.md) → "What this design does not do") — addressable by `redux-persist` or a small `localStorage` middleware applied to the whole store.
- **No sector-aware materiality presets.** A real ESG tool would offer industry templates ("Banking", "Oil & Gas", "Manufacturing") that pre-fill the sliders. v1 leaves this out by design — the user is the one expressing materiality, by hand. If added later, a preset is just a `Record<string, number>` keyed by metric id; a small dropdown above the sliders dispatches one `setWeight` per entry.
