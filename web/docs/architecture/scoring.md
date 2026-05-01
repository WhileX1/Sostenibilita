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

## Persistence

Weights persist across reloads via the same `localStorage` layer that handles window state — see [`web/store/persist/persist.ts`](../../store/persist/persist.ts). The persisted blob is sanitised on load: any metric id no longer in `SCORED_METRICS` is dropped, any newly-added metric gets the midpoint default, and every value is re-clamped to `[0, MAX_WEIGHT]` so a hand-edited entry can't push a slider out of range.

## What v1 does not do

- **No input data, no score.** Each metric's window is still a placeholder. v1 ends at "weights are configured"; everything downstream of that is in the [Roadmap](#roadmap--user-defined-metrics-and-custom-formulas) below.
- **No sector-aware materiality presets.** A real ESG tool would offer industry templates ("Banking", "Oil & Gas", "Manufacturing") that pre-fill the sliders. v1 leaves this out by design — the user is the one expressing materiality, by hand. If added later, a preset is just a `Record<string, number>` keyed by metric id; a small dropdown above the sliders dispatches one `setWeight` per entry.

## Roadmap — user-defined metrics and custom formulas

The long-term direction is to make scoring **user-programmable**: the 10 hardcoded E/S/G metrics become factory presets, the user can add/edit/remove metrics, and each metric's score is computed by a small formula the user types in by hand against the metric's own input variables.

### Why this shape

A real ESG tool can't ship one fixed score function per metric — what counts as "good" energy performance for a manufacturer is not what counts for a bank. Sector-specific scoring rules vary too much to enumerate. Letting the user write the formula puts the domain model in the user's hands while the system stays domain-agnostic.

### The four building blocks

1. **A small expression DSL.** Numbers, the named input variables of the current metric, the operators `+ - * / %`, parentheses, and a handful of built-ins (`min`, `max`, `clamp`, `sqrt`). Lives in `web/lib/formula/` as a self-contained module: tokenizer → recursive-descent parser → AST evaluator. Deliberately not `eval()`, not `Function()`, not a third-party library — the input surface is small enough that ~200 lines of TypeScript is the right size, the AST is easy to reason about for security, and writing the parser ourselves is the part of this project that has the most pedagogical value.
2. **A metrics slice.** Replaces the static `SCORED_METRICS` list with `Record<id, { title, area, formula, inputs }>` in Redux, seeded with the 10 current E/S/G windows as defaults. The `Strategy` page's slider grid then iterates this slice instead of the registry, so adding a metric automatically adds a slider. Persistence piggy-backs on the existing `localStorage` layer.
3. **A per-metric editor.** Inside each metric's window: a small form for the metric's inputs (a list of named numeric fields the formula can refer to), a textarea for the formula itself, and a live "preview" that re-evaluates against the current input values and shows the resulting `0..100` score plus any parse / runtime error. The textarea is custom (not CodeMirror / Monaco) — for ~13 variables a textarea + popover is enough, and a heavyweight code editor would visually clash with the Win2K shell.
4. **Variable autocomplete.** As the user types, suggest the in-scope input names (and built-in functions) that match what they've typed so far. Implementation: a popover anchored to the caret rect of the textarea, a controlled state for the current "prefix" being typed, and a filtered list driven by the metric's input names. Polish, not a blocker.

### Suggested order of implementation

1. The DSL as a pure library, with unit tests, no UI. Self-contained — easy to demo and easy to revise without breaking anything else.
2. The metrics slice, seeded with the existing 10 metrics, with the `Strategy` page rewired to read from it. No editor yet; behaviour is identical to v1 from the user's perspective.
3. The per-metric editor (inputs + formula textarea + live evaluation). At this point the system is end-to-end functional: a user can change a formula, watch the score update, and have it persist across reloads.
4. Autocomplete on top of the editor. Last because it's UX polish — every prior step is demonstrable without it.

### What this changes elsewhere

- The `scored` flag in [`registry.ts`](../../lib/windows/registry.ts) becomes a hint for the *factory seed* (which windows ship with a default metric entry), not a runtime filter — the source of truth shifts from registry to slice.
- The persistence layer needs a new top-level slice and a small bump to `SCHEMA_VERSION` in [`persist.ts`](../../store/persist/persist.ts), with a migration for users who have a v1 blob (drop the old shape, re-seed from defaults).
- The window manager is unaffected — windows are still defined in the registry, only their *content* learns about the metrics slice.
