import { WINDOW_DEFINITIONS, type WindowDefinition } from "@/lib/windows/registry";

// Single shared maximum for every metric's materiality weight. Sector-agnostic:
// the system doesn't pre-bake which metric matters more — the user expresses
// that in `Strategy` by lowering the sliders that don't apply to them.
export const MAX_WEIGHT = 10;

// The ESG metrics that contribute to the overall score — every registry
// entry flagged with `scored: true`. Today: the 10 E/S/G windows. The 3
// Objective windows (Reporting CSRD, Rating ESG, Strategy) are unflagged
// and stay out of the score because they're outputs / configuration of
// the system, not measurable inputs.
export const SCORED_METRICS: WindowDefinition[] = WINDOW_DEFINITIONS.filter(
  (w) => w.scored === true,
);
