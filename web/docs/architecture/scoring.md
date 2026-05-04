# ESG Scoring

The Strategy / Rating ESG / Reporting CSRD windows together implement a **three-layer materiality-weighted scoring** model:

1. **Per-metric rating** — inside each metric's editor, the user writes a small DSL formula that computes *components* on their natural scale (fractions, kWh/€, true/false, …), then weights those components with sliders and assigns each a `[min, max]` *judgement range*. The rating is a 0–100 number: each component is normalized via its range, optionally inverted by the formula's `+`/`−` sign, then averaged with the slider weights as positive shares.
2. **Materiality across metrics** — the Strategy window weights how much each scored metric matters for the user's organisation. Same Strategy-style sliders, normalized to shares.
3. **Aggregated ESG rating** — the Rating ESG window combines every per-metric rating with the materiality weights into the overall ESG score and the three area sub-scores.

Each metric is **user-programmable**: the DSL formula transforms raw inputs into components; ranges declare "what counts as good vs. bad" for each component on its native scale; sliders weight components into the rating. All fifteen scored windows — covering every ESRS topical chapter (E1-E5, S1-S4, G1) — render through the same generic [`MetricEditor`](../../components/metricEditor/MetricEditor.tsx); ten ship with calibrated seeds today, five default to "not material" for the Italian SME profile and can be opted in by the user.

### Materiality switch

Every scored metric carries an `isMaterial: boolean` flag. The CSRD framework treats every ESRS topic as "must be addressed" — the user either does the assessment or explicitly declares it not material; silence is not an option in a real statement, and we mirror that discipline here. When a metric is flagged not material:

- The metric editor hides inputs / formula / sliders behind a callout panel that records the user's free-form rationale (`notMaterialReason`).
- `computeMetricRating` returns `null` so the metric drops out of every aggregate (numerator AND denominator) — non-material doesn't count as a 0/100 score.
- Strategy renders the metric's slider greyed out (still navigable, doesn't dilute the share computation).
- Reporting CSRD lists the metric under "Topics not assessed" with the user's reason instead of in the per-area sections.

Five metrics ship with `isMaterial: false` by default — Pollution (E2), Biodiversity (E4), Value Chain Workers (S2), Affected Communities (S3), Consumers and End-Users (S4) — each with a default reason calibrated for the Italian light-manufacturing SME profile. They still ship with a *full* editor body (inputs, formula, ranges, values), so flipping the materiality toggle on lands the user on a populated assessment they can adjust — never on a blank form.

## Pieces

| Layer             | Role                                                                                                       | Lives in                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Scoring config    | The list of scored metrics + the materiality weight cap. Pure data, no React, no Redux.                    | [`web/lib/scoring/config.ts`](../../lib/scoring/config.ts)                                                                     |
| Esg slice         | Per-metric materiality weight (0–10 integer) used by Strategy.                                              | [`web/store/slices/esgSlice.ts`](../../store/slices/esgSlice.ts)                                                               |
| Metrics slice     | Per-metric editable config: list of `InputDefinition`s, formula source, current values, *per-variable component weights*, *per-variable judgement ranges*. | [`web/store/slices/metricsSlice.ts`](../../store/slices/metricsSlice.ts)                                                       |
| Formula DSL       | Tokenizer / parser / evaluator / syntax-highlight tokenizer / autocomplete helper / score-vars extractor.   | [`web/lib/formula/`](../../lib/formula/) — see [`formula-dsl.md`](formula-dsl.md) for the language reference                   |
| Strategy UI       | Per-metric materiality slider + live-normalised share %. Where cross-metric weights are edited.            | [`web/components/pages/objective/Strategy.tsx`](../../components/pages/objective/Strategy.tsx)                                 |
| Rating runner     | Pure functions that turn a `MetricConfig` into a 0..100 rating (`computeMetricRating`) or, given an already-evaluated formula, derive the rating from its scope (`ratingFromEval`). Shared by the editor and the aggregator. | [`web/lib/scoring/rating.ts`](../../lib/scoring/rating.ts)                                                                   |
| Rating ESG UI     | Read-only aggregator. Shows the materiality-weighted overall ESG score, three area sub-scores, and a per-metric breakdown (rating bar + share %). Has no editable controls of its own — it links back to Strategy for materiality. | [`web/components/pages/objective/RatingEsg.tsx`](../../components/pages/objective/RatingEsg.tsx)                              |
| Reporting CSRD UI | Read-only "document" view. ESRS-tagged sustainability statement with executive summary, materiality matrix, per-metric sections (inputs + formula + components + narrative), disclaimer. Print-to-PDF via the browser. | [`web/components/pages/objective/ReportingCsrd.tsx`](../../components/pages/objective/ReportingCsrd.tsx)                      |
| Metric editor     | Generic per-metric editor (inputs table + syntax-highlighted formula textarea + components-and-sliders section + live preview). Parameterised on `metricId` + `title`; the per-page wrappers under `web/components/pages/<area>/` just plug in the registry id and the title.    | [`web/components/metricEditor/MetricEditor.tsx`](../../components/metricEditor/MetricEditor.tsx) (generic), per-page wrappers like [`EnergyConsumption.tsx`](../../components/pages/environmental/EnergyConsumption.tsx) and [`Co2Emissions.tsx`](../../components/pages/environmental/Co2Emissions.tsx)       |

## Which metrics are scored

Each registry entry that contributes to the ESG score is flagged with `scored: true`. The 15 E/S/G windows (one per ESRS topical chapter the user might address) are flagged; the 3 Objective windows (Reporting CSRD, Rating ESG, Strategy) are not — they're *outputs* and *configuration of the system itself*, not measurable inputs. Each scored entry also carries an `esrs: { code, topic }` block so the standards anchor is defined once in the registry and consumed by Reporting CSRD without a separate mapping table.

```ts
export const SCORED_METRICS: WindowDefinition[] = WINDOW_DEFINITIONS.filter(
  (w) => w.scored === true,
);
```

The flag is explicit on purpose: a future Objective window could opt into scoring by setting `scored: true` on its registry entry, without needing to move it to a different area (areas are a UI grouping for the Start menu, not a scoring concept). Symmetrically, a non-scored helper window in E/S/G is also possible just by leaving the flag off.

## Materiality weights (Strategy)

Every scored metric has an integer weight in `[0, MAX_WEIGHT]` where `MAX_WEIGHT = 10`. The default is the **midpoint** (5/10), so every metric counts equally on first load and the user moves sliders up or down to express which metrics matter more or less for their organisation.

### Why midpoint, not max

Max would also produce an "all equal" baseline — but a max baseline only allows the user to *down-weight* a metric (sliders only move down). Midpoint preserves both directions, which matches the mental model of "raise the ones that matter, lower the ones that don't".

### Why a flat 0–10, not per-metric maxes

A draft of this design had per-metric max weights tuned to typical ESG materiality (CO₂ at 30, water at 8, etc.). Rejected: it bakes a single sector's materiality into the system, when materiality varies by industry. The flat 0–10 is *sector-agnostic*; the user expresses materiality themselves by moving the sliders.

## Per-metric scoring (components + sliders)

Inside a single metric's editor, the formula DSL's `score = …` line is read as a **declaration of the metric's components**, not as the rating's literal computation. The editor walks the AST of `score = …` and extracts each referenced identifier — every one becomes a slider row below the formula, with its own weight, range, and resulting share %.

### Components

A component is any identifier referenced in the right-hand side of `score = …`. It can be:

- a **computed variable** the formula assigns (`renewable_share = kwh_renewable / kwh_total`), or
- an **input** referenced directly (`iso_50001`, a boolean — coerces to 0/1 in the rating like it does in the DSL's arithmetic).

The formula is the *components factory*: it transforms raw inputs into intermediate values on whatever native scale makes sense (a fraction, a kWh/€ ratio, a yes/no flag). It does **not** need to produce 0–100 sub-scores; the range does that work.

### Ranges

Every component carries a `{ min, max }` declared by the user — the *judgement scale* mapping the variable's native value onto 0..100:

- `(raw - min) / (max - min) * 100`, then clamped to `[0, 100]` so out-of-range values saturate at the boundary.
- `min` and `max` are **auto-swapped** if the user types them inverted: the lower number is always the 0% endpoint, the higher is the 100%. Direction is *not* encoded in range order — it lives in the formula's sign.
- A degenerate range (`min === max`) becomes a step function: anything at-or-above the value reads as 100%, anything below as 0%.

### Direction

The sign in front of each component in `score = …` flags whether higher-is-better (`+`) or lower-is-better (`−`):

```
score = renewable_share + reduction + iso_50001 - energy_intensity
```

Components flagged `−` get their normalized contribution inverted (`100 - normalized`) before averaging — so "lower intensity is better" reads as a higher rating contribution without breaking the weighted-average bound to 0..100. The slider section shows a `−` prefix next to the component name as a visual reminder.

### Score expression shape

The sign extraction works on `+`, `−`, unary `−`, and parens added/subtracted (`a + b - (c + d)` flattens to `[+a, +b, -c, -d]`). Anything outside that shape — `*`, `/`, function calls, percent — falls back to **"all components positive"**: the rating is still computed, but every referenced identifier contributes additively regardless of how the formula combines them. The convention to communicate to users (and that the help panel does communicate) is:

> Move complex math into intermediate computed variables; keep the final `score = …` a clean sum.

If `score = …` references no variables (e.g. `score = 50`), the rating falls back to the formula's clamped literal value — simple constants still produce a usable number.

### Component weights

Each component has a slider in the section below the formula, raw weight `0..MAX_WEIGHT`, default *midpoint* (5/10) — same convention as Strategy. The shares are normalized over the visible components (`weight_i / Σweights`), so orphan weights for variables no longer in the formula don't dilute the total. Rating:

```
share_i = w_i / Σw_j
norm_i  = clamp(0..100, (raw_i − range.min) / (range.max − range.min) × 100)
if sign_i == −1: norm_i = 100 − norm_i
rating  = clamp(0..100, Σ share_i × norm_i)
```

The clamp at the end is a safety net for the corner cases (out-of-range raw values combined with negative-sign inversion can push the average outside [0, 100] if the user mis-sets a range; a real ESG context expects 0–100 ratings).

## State shape

```ts
interface EsgState {
  // Cross-metric materiality. Integer in [0, MAX_WEIGHT], default
  // midpoint, set by Strategy's sliders.
  weights: Record<string, number>;
}

interface MetricConfig {
  // User-defined input variables that the formula reads.
  inputs: InputDefinition[];
  // The DSL source the user types in the editor.
  formula: string;
  // Current values keyed by input name. Always in lockstep with
  // `inputs` (the addInput / removeInput / updateInput reducers
  // maintain this invariant).
  values: Record<string, Value>;
  // Per-component slider weights for the rating computation. Keys
  // are identifiers referenced in `score = …`. Stale keys are kept
  // so a temporary formula edit doesn't wipe out user choices.
  weights: Record<string, number>;
  // Per-component judgement ranges. Keys mirror `weights`. Missing
  // entries default to `{ min: 0, max: 100 }` (the identity for
  // already-normalized 0..100 components).
  ranges: Record<string, { min: number; max: number }>;
}
```

`MetricConfig` per-id lives in the metrics slice's `byId` map. Defaults are seeded by `defaultMetricsState()`, which iterates `SCORED_METRICS` and assigns either the metric's factory seed (today: ten material seeds + five not-material presets covering E2/E4/S2/S3/S4) or an empty config (the fallback for any future scored metric without a seed).

Materiality `EsgState.weights` defaults are seeded at module load by `defaultWeights()`, which assigns `Math.round(MAX_WEIGHT / 2)` to each scored id.

## Reducer actions

### Esg slice

| Action                              | Effect                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `setWeight({ id, weight })`         | Set `weights[id]` to the value, rounded and clamped to `[0, MAX_WEIGHT]`. No-op if the id isn't a known metric. |
| `resetWeights()`                    | Re-seed every weight to the midpoint default.                                                 |

### Metrics slice

| Action                                          | Effect                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `addInput({ metricId, input })`                 | Push a new input definition; reject duplicate names.                                          |
| `removeInput({ metricId, name })`               | Drop the input *and* its current value entry.                                                 |
| `updateInput({ metricId, name, patch })`        | Rename and/or retype the input. Renaming moves the value to the new key; type changes reset the value to the new type's default. |
| `setInputValue({ metricId, name, value })`      | Type-checked write into `values`.                                                             |
| `setFormula({ metricId, formula })`             | Write the DSL source.                                                                         |
| `setVarWeight({ metricId, name, weight })`      | Per-component slider weight, integer-clamped. The UI bounds to `[0, MAX_WEIGHT]`; the slice clamps to `[0, 255]` defensively. |
| `setVarRange({ metricId, name, min, max })`     | Per-component judgement range. Both endpoints must be finite numbers. The slice does not enforce `min <= max` at the boundary; the UI's `normalizeToPercent` auto-swaps. |
| `resetMetric({ metricId })`                     | Re-seed the entire `MetricConfig` for that metric from the factory default.                   |
| `setMaterial({ metricId, isMaterial })`         | Toggle the metric's `isMaterial` flag. Flipping back to `true` clears any stale `notMaterialReason` so it doesn't resurface on a second toggle. |
| `setNotMaterialReason({ metricId, reason })`    | Free-form rationale shown in Reporting CSRD's "Topics not assessed" sub-section. No-op when the metric is currently material — the reason is tied to the not-material *decision*. |

## Strategy page

The Strategy window iterates the three scored areas (Environmental / Social / Governance), groups metrics by area into a `<fieldset>`, and renders one row per metric:

```
[ Metric name ]  [────●────slider────]  [ 5/10 ]  [ 10.0% ]
```

The share column is `weight / Σweights × 100`, recomputed on every render. As the user moves a slider, every other metric's share updates in real time — shares always sum to 100% regardless of where the raw weights sit. This is the **live-normalisation** model: the user sees the consequence of every adjustment without having to manually rebalance.

The footer pairs *Reset to defaults* (left) with the raw total `Σweights / (SCORED_METRICS.length × MAX_WEIGHT)` (right). The raw total is purely informational — score computation reads `weights` and normalises on demand, not the running total.

## Persistence

Weights and metric configs persist across reloads via the same `localStorage` layer that handles window state — see [`web/store/persist/persist.ts`](../../store/persist/persist.ts). The persisted blob is sanitised on load:

- **Materiality weights**: any metric id no longer in `SCORED_METRICS` is dropped, any newly-added metric gets the midpoint default, and every value is re-clamped to `[0, MAX_WEIGHT]`.
- **Metric configs**: each scored id is seeded with either a valid persisted entry or the factory default. For valid entries, `reconcileValues` drops orphan keys, fills in missing values, and resets type-mismatched values; `reconcileWeights` and `reconcileRanges` do the same for the per-component slider state — malformed entries drop silently rather than rejecting the whole metric.
- **Schema migration**: the version number is bumped when the shape changes incompatibly. The lenient `reconcile*` helpers let `MetricConfig` grow new optional fields (the `weights` and `ranges` maps were added after the initial v2 shape) without rejecting older blobs — the user keeps their inputs, formula, and values across the upgrade and just gets empty defaults for the new fields.

## Per-metric editor

The editor lives in [`web/components/metricEditor/MetricEditor.tsx`](../../components/metricEditor/MetricEditor.tsx) — a single generic component parameterised on `metricId` (which `MetricConfig` to read from the slice) and `title` (header text). Each page under `web/components/pages/<area>/` is a thin wrapper that picks the registry id and the page title; no per-page editor logic.

All fifteen scored metrics ship with domain-specific seeds today, calibrated for an Italian SME (~50 employees, ~1.5M€ revenue, light manufacturing). Each seed picks a representative real-world starting point with at least one obvious "improvement lever" — a missing certification, an unfilled boolean, a metric below sector benchmark — so the user lands on a usable score and immediately sees what to change. Ten of those start `isMaterial: true` (fully active in the rating). The remaining five (Pollution, Biodiversity, Value Chain Workers, Affected Communities, Consumers and End-Users) start `isMaterial: false` with a profile-appropriate reason — they still carry a full editor body (inputs, formula, ranges, values), so flipping the materiality toggle on lands the user on a populated assessment, never on a blank form.

### Seed catalogue (material)

| Area | Metric | Components | Standards anchor | Seed score | Headline lever |
| --- | --- | --- | --- | --- | --- |
| Environmental | Energy Consumption | renewable_share, reduction, iso_50001, energy_intensity | GRI 302 / ESRS E1 | ~41 | ISO 50001 |
| Environmental | CO₂ Emissions | reduction, sbti_validated, carbon_intensity | GHG Protocol / ESRS E1 | ~59 | SBTi validation |
| Environmental | Water Usage | recycle_share, reduction, water_management_plan, water_intensity | GRI 303 / ESRS E3 | ~44 | management plan |
| Environmental | Waste Management | recycle_share, reduction, iso_14001, hazardous_share, waste_intensity | GRI 306 / ESRS E5 | ~59 | ISO 14001 |
| Social | Human Resources | training_intensity, permanent_share, welfare_program, turnover_rate | GRI 401, 404 / ESRS S1 | ~46 | welfare programme |
| Social | Inclusivity | women_share, women_leadership_share, disability_share, inclusive_policy, gender_pay_gap | GRI 405 / ESRS S1-9, S1-16 / Legge Golfo-Mosca | ~43 | leadership representation |
| Social | Health and Safety | safety_training_intensity, iso_45001, incident_rate, lost_day_intensity | GRI 403 / ESRS S1-14 / D.Lgs. 81/08 | ~45 | ISO 45001 |
| Governance | CDA | independence_share, women_share, board_meetings, ceo_chair_separated | GRI 2-9..2-21 / ESRS G1 / Codice Autodisciplina | ~36 | CEO/Chair split |
| Governance | Ethics & Compliance | code_of_ethics, model_231, whistleblowing_channel, compliance_training_intensity, compliance_violations | GRI 205 / ESRS G1 / D.Lgs. 231/2001, 24/2023 | ~65 | Modello 231 |
| Governance | Supply Chain | screened_share, local_share, audit_intensity, supplier_code_adopted | GRI 308, 414 / ESRS G1-2 / CSDDD | ~29 | supplier code |

Score band 29–65 with midpoint weights — Governance trends low (CDA, Supply Chain) and Ethics trends high because the regulatory baseline (D.Lgs. 24/2023 whistleblowing mandate above 50 employees) forces a couple of "yes" answers. Detailed rationale for each seed lives in the per-seed comment block in [`metricsSlice.ts`](../../store/slices/metricsSlice.ts).

### Seed catalogue (default not-material — full editor body, opt-in)

| Area | Metric | Components | Standards anchor | Default reason (SME profile) |
| --- | --- | --- | --- | --- |
| Environmental | Pollution | treated_share, voc_intensity, svhc_substances_count, pollution_violations | ESRS E2 / E-PRTR | Light manufacturing, no significant emissions to air/water/soil under E-PRTR thresholds |
| Environmental | Biodiversity | green_share, nearest_protected_km, biodiversity_plan | ESRS E4 / Natura 2000 | Operations confined to existing industrial premises, no land use in/near protected areas |
| Social | Value Chain Workers | labor_audit_share, human_rights_clause, living_wage_committed, labor_violations_disclosed | ESRS S2 / CSDDD | Covered indirectly via Supply Chain (G1-2); standalone S2 requires value-chain mapping beyond current scope |
| Social | Affected Communities | local_share, community_giving_intensity, community_grievance_channel, community_complaints | ESRS S3 | No operational impact on local communities outside standard noise/traffic from the production site |
| Social | Consumers and End-Users | privacy_program, complaint_intensity, safety_incidents | ESRS S4 / GDPR | B2B-only sales, product-safety obligations handled at the customer-contract level |

These reasons (and the seeded values) are written from the Italian-SME perspective; a services company or a chemicals company would flip a different subset on/off and adjust the seed values accordingly.

### What the editor exposes

- **Inputs table** — one row per `InputDefinition`. The `Name` cell is azure (matches the formula's input identifiers); the `Type` cell is coloured per type (number → green, boolean → teal, string → orange — same as the literal of that type would be inside the formula). The `Value` cell renders type-specific controls (number / checkbox / text). A `×` button removes the input.
- **Add-input row** — same 5-column grid as the table above. The `Value` cell is empty (the value is set after the input is added); when validation fails (empty name, reserved keyword, duplicate, invalid identifier), the error message renders *in that same Value cell*, in red.
- **Formula textarea** — a syntax-highlighted overlay sits behind a transparent textarea. The wrapper paints the white sunken-bevel surface; the overlay paints coloured spans on top of it; the textarea (transparent text, transparent background) provides the caret and selection. While the user is typing an identifier, a **Copilot-style inline ghost completion** appears in muted grey directly after the caret, suggesting the top matching input / computed / keyword / built-in (case-insensitive prefix, names ranked above language keywords, exact matches filtered out). `Tab` accepts the suggestion; `Esc` dismisses it for the current prefix. The ghost is rendered by a second overlay whose prefix portion is `color: transparent` — same font and padding as the textarea, so the layout takes the same horizontal space and the ghost lands at the caret without any DOM measurement. See [`formula-dsl.md`](../architecture/formula-dsl.md#autocomplete-helper-suggestts) for the activation rules.
- **Live scope chips** — under the formula, every variable in scope at the end of evaluation (inputs *and* computed, except `score`) renders as a small chip "name = value", coloured by kind (azure for inputs, violet for computed). Lets the user verify each step of the computation without re-doing the math in their head.
- **Component weights & ranges section** — appears under the formula whenever `score = …` references one or more variables. A single header row above the data labels the four numeric columns (Range / Share / Contribution / Headroom) — the variable, slider, and raw-weight columns are intentionally unlabelled because their content already carries its own meaning. The Range header is left-aligned to match the inline `[min] – [max]` editor below it (a flex block that takes its natural width from the left of its cell); the other three are right-aligned to match their numeric data. Then one row per component: name (with `−` prefix for negative-direction), weight slider, raw weight (`n/MAX`), inline `[min] – [max]` range editor, share %, **contribution** (`share × normalized / 100` — rating points the row currently delivers to the metric's score), and **headroom** (`share × (100 − normalized) / 100` — rating points still on the table at 100% normalized). Contribution and headroom mirror the columns in the report's per-metric Components table, so the same weighted-impact picture is visible while editing — drag a slider and the impact-in-points readouts update with the share %, instead of forcing the user to convert from share to delivered points in their head. Both impact cells fall back to a dash when the formula doesn't evaluate (the share % stays live because it's purely user-controlled). Reuses the `win2k-slider` class from Strategy; the range fields are uncontrolled inputs that commit on blur or Enter so partial typing (`1.`, `-`) doesn't get rejected mid-keystroke.
- **Help panel** — a `?` button in the section legend toggles an inline reference card with operators, keywords, built-ins, the calculator-style `%` rule, and **the components-and-sliders convention specific to this editor** (the `score = …` declaration semantics, the role of `+`/`−` for direction, the fallback for complex expressions). Local to this editor, not a system-wide doc.
- **Score footer** — single row: `Score`, the rating value `n / 100`, and the `Reset to defaults` button. The rating is `Math.round(...)`; it's `—` while the formula has an error and `waiting for data` if `score` was never assigned.

### Live evaluation

The component compiles the formula via `compile(src)` once per source change, then `evaluate(ast, values)` runs on every input-value change without re-parsing. The slider section reads its components from `extractScoreVarsFromText(src)` — *not* from the compiled AST — so the rows stay visible (and adjustable) even when the wider formula has a parse error somewhere else. The text extractor tries the full compile first, then a line-isolated parse of the last `score = …` line, then a regex tier as last resort; see [`formula-dsl.md`](formula-dsl.md#score-vars-extractor-scorevarsts) for the three-tier rationale. Errors from compile or evaluate surface as a red inline message directly under the textarea (line/col + message); the rating value reads `—` while the formula has an error, but the slider rows themselves stay populated.

### Why the textarea is a custom overlay, not a code editor

Monaco / CodeMirror would handle the syntax highlighting better, but they bring 100kB+ of bundle weight and don't visually fit the Win2K shell. For a DSL with ~10 variables and ~5 operators per formula, a textarea + transparent overlay + the formula library's `highlight()` segment list is enough. The bottleneck for users isn't the editor — it's understanding the language and the metric's domain.

## Rating ESG aggregation

The Rating ESG window walks every entry in `SCORED_METRICS`, calls `computeMetricRating(config)` to get its 0..100 rating, and reads its materiality weight from the `esg` slice. It then computes:

```
overall   = Σ(rating_i × materiality_i) / Σ(materiality_i)
area(A)   = Σ(rating_i × materiality_i for i in A) / Σ(materiality_i for i in A)
share(i)  = materiality_i / Σ(materiality_j) × 100
```

A metric whose rating is `null` (formula doesn't compile, evaluation throws, no usable score variables) is silently dropped from both the numerator and the denominator. The alternative — propagating `null` upward — would make the overall ESG score vanish whenever the user is mid-edit on any single metric, which feels punitive for a panel that should always show the best-effort number.

The page is **read-only**: it links back to the Strategy window for materiality changes (via `dispatch(openWindow("objective/strategy"))`) and to each metric's own editor for formula / range / slider changes. No controls of its own.

The per-metric rating bar is colour-banded — red below 40, orange 40–70, green above 70 — which lines up with how field ESG ratings are described qualitatively (CCC/B/BB → A/AA → AAA-ish). It's visual shorthand, not a methodological claim.

## Reporting CSRD

The Reporting CSRD window consumes everything (`metricsById`, `materiality`, the rating runner, the registry) and lays it out as a CSRD-flavoured **sustainability statement**: a read-only document view with executive summary, materiality matrix, per-metric sections, and a disclaimer. No state of its own — every change made elsewhere reflects here on the next render.

### Structure

1. **Document header** — title, FY placeholder, generated date.
2. **Executive summary** — overall ESG score (large) plus the three area sub-scores. Same data as Rating ESG, restated in document register.
3. **Materiality assessment** — table of every metric flagged material with its Strategy weight and ESRS code (`E1`, `S1`, `G1`, …), followed by an explicit "Topics not assessed" sub-table sourced from the metrics flagged `isMaterial: false`. The user's free-form rationale (`notMaterialReason`, edited in the metric editor) appears as the right-hand cell. Disclosing what is *not* covered is part of the CSRD self-discipline; silence would be worse than honesty. The two tables are derived dynamically from the slice — there is no separate hardcoded "not covered" list to keep in sync.
4. **Per-area sections** — one per E/S/G area, with a metric block per scored window. Each metric block shows:
   - Title + ESRS code subtitle (e.g. "Energy Consumption · ESRS E1");
   - Materiality share + raw weight;
   - Rating bar + numeric value;
   - One-sentence factual narrative (auto-generated). Picks components by **weighted impact on the metric's score**, not by raw normalized %. Since `rating = Σ (share_i / 100) × normalized_i`, each component contributes `share × normalized / 100` rating points and could add `share × (100 − normalized) / 100` more if it reached 100%. "Highest contribution" = max of the former (currently delivering the most points), "Greatest improvement opportunity" = max of the latter (biggest lever to move the score). Ranking on raw normalized would mislabel a low-weight 90% component as the biggest contributor and a low-weight 10% one as the biggest opportunity — neither moves the score much. Numbers in parentheses are reported in **rating points**, the same 0-100 scale as the metric;
   - **Inputs** — definition list (label + identifier + value);
   - **Methodology — formula** — code block of the user's DSL source. ESRS 1 §53-54 requires methodology disclosure; for our app the formula *is* the methodology, so showing it is more compliant than hiding it;
   - **Components** — table with column per dimension (Component, Direction, Range, Raw, Normalized, Share, Contribution, Headroom). The two trailing columns expose the same per-component arithmetic the narrative uses for its picks: **Contribution** = `share × normalized / 100` rating points (what this dimension is currently giving the metric's score) and **Headroom** = `share × (100 − normalized) / 100` rating points (what it could still add at 100% normalized). Showing them per-row makes the weighted picks in the narrative line verifiable at a glance instead of asking the reader to multiply Share by Normalized themselves.
5. **Footer** — disclaimer ("self-assessment, not audited, not a substitute for the official CSRD statement under Directive (EU) 2022/2464") + Print button.

### ESRS mapping

Each scored metric carries an `esrs: { code, topic }` block on its `WindowDefinition` entry in [`web/lib/windows/registry.ts`](../../lib/windows/registry.ts). The report reads it directly off the registry — single source of truth, no parallel mapping table. A future sector-template preset could override the codes via a registry decorator without touching the report component.

### Print support

The user prints the report by hitting the "Print / Save as PDF" button, which calls `window.print()`. The `@media print` block in [`globals.css`](../../app/globals.css) is engineered around three concrete print bugs that the Win2K shell + colour-aware report would otherwise cause:

1. **Printing only the visible viewport instead of the full report.** The window root is `position: absolute; inset: 10%` (an 80 % bounding box) and the bodyContent inside it has `overflow: auto` (a scrollable inner viewport). Without intervention, the print engine sees the report constrained to that visible-window rectangle and prints exactly what fits — a "simplified" first-page snippet rather than the multi-page document. Fix: hide every element via `visibility: hidden`, re-show the `.printable-report` subtree, and use `*:has(.printable-report)` to strip `position`, `overflow`, `height`, `inset`, `padding`, `margin`, and `box-shadow` from every ancestor. The report flips to `position: static; width: 100 %` and flows freely from the top of the page; the print engine paginates across as many pages as it needs.
2. **Section headings orphaned at the bottom of a page.** The h2 area headings ("Environmental", "Social", "Governance") would land at the bottom of one page while the first metric block jumped to the next. Fix: `breakAfter: avoid` on `h2`/`h3`/`h4` and on `metricHeader`. The print engine now pushes any heading that can't be followed by content on the same page down to the next page. `metricBlock` retains its `breakInside: avoid` so each per-metric section stays whole; `breakInside: avoid` is also added to `metricHeader` for the rare case where a metric is too tall to fit and the engine has to split it anyway (the title and rating row stay together).
3. **Coloured fills printing as white.** Chromium-family browsers strip background colours during print to save ink, which gutted the rating bars (red/orange/green fills became invisible) and flattened the metric block / panel surfaces to all-white. Two-layer fix:
   - `print-color-adjust: exact` (and `-webkit-print-color-adjust: exact` for Chromium/Safari) on `.printable-report` and every descendant. The browser is told to opt out of ink-saving for the report. Text colours print fine without this — only background-paint surfaces (panel backgrounds, code-block surfaces) needed the explicit opt-in.
   - `RatingBar` renders the coloured fill as an SVG `<rect>` rather than a div with a CSS background. The CSS hint above is honoured by most browsers, *but the user's manual "Background graphics" toggle in the print dialog still wins* — when it's off, divs with backgrounds print white regardless of the page's CSS. SVG fills are treated as content (like text), bypassing that machinery entirely. The bar is the metric's primary visual signal; making it survive any combination of browser and user settings is worth the few extra lines of SVG. The wrapper div still carries the sunken bevel via box-shadow — that's purely decorative, so losing it in ink-saving mode is acceptable.

Other print details: the Print button itself carries the `.no-print` class so it never appears in the printed output. `@page { margin: 1.5cm }` leaves room for browser-added headers/footers.

## What's not built yet

- **No historical inputs.** Values are current-year only — `MetricConfig.values` is a flat `Record<name, Value>`. When the YoY trend in Rating ESG becomes a real feature, this will widen to `Record<year, Record<name, Value>>` and the formula DSL will probably grow a `prev(x)` built-in for "x's value last year".
- **No sector-aware materiality presets.** A real ESG tool would offer industry templates ("Banking", "Oil & Gas", "Manufacturing") that pre-fill both Strategy's materiality sliders *and* per-metric ranges (energy intensity expectations differ wildly by sector). Easy to add later as a `Record<string, …>` per industry; out of scope for now.
- **No editable narrative in the CSRD report.** All text in Reporting CSRD is auto-generated; the user can't add free-form commitments, transition plans, or sector-specific framing. A future iteration could add an `esgReport` slice with per-section text overrides — but the auto-generated factual report is enough to demonstrate the loop.
- **No CSRD targets / transition plans.** ESRS E1-4 (climate transition plan), S1-5 (workforce targets), etc. require forward-looking targets per metric. The data model could grow a `targets: Record<name, { value: number; year: number }>` per metric and the report would show progress vs target — out of scope for now.
