// Per-metric rating computation, factored out of the editor so the
// `Rating ESG` aggregator can reuse it without duplicating the
// components-and-sliders logic. Pure functions, no React.
//
// Two entry points:
// - `ratingFromEval` — when the caller already has a compiled+evaluated
//   formula (the editor uses this to avoid re-parsing on every render).
// - `computeMetricRating` — one-shot from a `MetricConfig`; compiles +
//   evaluates internally. The aggregator uses this.

import { MAX_WEIGHT } from "./config";
import {
  compile,
  evaluate,
  extractScoreVars,
  type ScoreVar,
  type Value,
} from "@/lib/formula";
import type { MetricConfig, VarRange } from "@/store/slices/metricsSlice";

// Default judgement range for components without a user-set entry. The
// identity for already-normalized values: a component on a 0..100 scale
// (like `renewable_share`) maps unchanged.
export const DEFAULT_RANGE: VarRange = { min: 0, max: 100 };

// Midpoint of the slider's raw 0..MAX_WEIGHT range. Used as the
// fallback when a variable has no entry in `weights` — the slider
// renders at the centre, signalling "neutral importance" and letting
// the user move in either direction. Matches the same convention
// `Strategy` uses for materiality sliders.
export const DEFAULT_VAR_WEIGHT = Math.round(MAX_WEIGHT / 2);

// Map a variable's raw value onto its declared 0..100 judgement scale.
// Linear interpolation with clamping: values below the lower endpoint
// snap to 0, values above the upper endpoint snap to 100.
//
// `min` and `max` are auto-swapped if the user types them inverted —
// the lower number is always treated as the 0% endpoint and the higher
// as the 100% endpoint, regardless of which field they put which in.
// This keeps the UI forgiving against typos; semantic direction
// ("higher is better" vs. "lower is better") is expressed via the
// formula's `+`/`−` sign in front of the variable, not via range order,
// so encoding direction in the range too would be a redundant duplicate.
//
// A truly degenerate range (min === max) gets a step function: anything
// at-or-above the value is 100%, anything below is 0%. Avoids a
// division by zero without rejecting the input.
export function normalizeToPercent(raw: number, range: VarRange): number {
  const lo = Math.min(range.min, range.max);
  const hi = Math.max(range.min, range.max);
  const span = hi - lo;
  if (span === 0) return raw >= lo ? 100 : 0;
  const pct = ((raw - lo) / span) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Compute the metric's 0..100 rating from an already-evaluated formula
// scope. The editor uses this — it has the eval result on hand and
// re-running compile/evaluate would be wasted work each render.
//
// Fallback: if `score = …` references no variables (e.g. `score = 50`
// or no `score = …` at all), the rating is the formula's literal
// `score` value, clamped — simple constants still produce a usable
// number.
//
// Returns `null` when the rating can't be computed: every score var
// has zero weight, or the score has no value to anchor the fallback.
export function ratingFromEval(
  scope: Record<string, Value>,
  score: number,
  scoreVars: ScoreVar[],
  weights: Record<string, number>,
  ranges: Record<string, VarRange>,
): number | null {
  if (scoreVars.length === 0) {
    return Math.max(0, Math.min(100, score));
  }
  let totalWeight = 0;
  let weightedSum = 0;
  for (const { name, sign } of scoreVars) {
    const w = weights[name] ?? DEFAULT_VAR_WEIGHT;
    const range = ranges[name] ?? DEFAULT_RANGE;
    const v = scope[name];
    let raw: number;
    if (typeof v === "number") raw = v;
    else if (typeof v === "boolean") raw = v ? 1 : 0;
    else continue;
    let normalized = normalizeToPercent(raw, range);
    if (sign === -1) normalized = 100 - normalized;
    totalWeight += w;
    weightedSum += w * normalized;
  }
  if (totalWeight === 0) return null;
  return Math.max(0, Math.min(100, weightedSum / totalWeight));
}

// One-shot rating from a metric's config. Returns `null` for any
// non-renderable state — metric flagged not material, formula doesn't
// compile, evaluation throws, no usable score variables and no
// fallback. The aggregator uses this to silently skip metrics that
// aren't producing a number (the alternative — propagating errors all
// the way up — would be noise when the user is mid-edit on a single
// metric and doesn't want the overall ESG score to vanish).
//
// Not-material metrics intentionally collapse to `null` rather than
// to 0: the latter would *count against* the company's score, while
// the user's stated intent ("this topic doesn't apply") is to remove
// it from scope entirely. `null` propagates through the aggregator's
// numerator/denominator-skip logic and gives the right semantics.
export function computeMetricRating(config: MetricConfig): number | null {
  if (!config.isMaterial) return null;
  const compiled = compile(config.formula);
  if (!compiled.ok) return null;
  const evalResult = evaluate(compiled.value, config.values);
  if (!evalResult.ok) return null;
  const scoreVars = extractScoreVars(compiled.value);
  return ratingFromEval(
    evalResult.value.scope,
    evalResult.value.score,
    scoreVars,
    config.weights,
    config.ranges,
  );
}
