import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { SCORED_METRICS } from "@/lib/scoring/config";
import type { Value } from "@/lib/formula";

// User-programmable per-metric config: a list of named/typed inputs, a
// formula script (DSL — see web/lib/formula), and the user's current
// values for those inputs. Title and area still come from the registry,
// which stays the source of truth for window identity; this slice owns
// only the editable side.

export type InputType = "number" | "boolean" | "string";

export interface InputDefinition {
  // Identifier the formula references. Must be a valid identifier
  // ([a-zA-Z_][a-zA-Z0-9_]*) and not collide with a DSL keyword/builtin —
  // the input editor enforces both before dispatching addInput / updateInput.
  name: string;
  type: InputType;
  // Optional human-facing label shown next to the input row in the editor.
  // Falls back to `name` when absent.
  label?: string;
}

export interface VarRange {
  min: number;
  max: number;
}

export interface MetricConfig {
  // Materiality assessment — whether the user has decided this ESRS
  // topic applies to their organisation. When `false`, the metric is
  // shown only as a "Topics not assessed" entry in Reporting CSRD,
  // is skipped from RatingEsg's aggregate, and the editor hides
  // inputs/formula/sliders behind the not-material panel. The CSRD
  // framework treats every ESRS topic as "must be addressed" — the
  // user either does the assessment or explicitly declares it not
  // material; silence is not an option in a real statement, and we
  // mirror that discipline here.
  isMaterial: boolean;
  // Free-form rationale shown in the report when `isMaterial: false`
  // (e.g. "Not material: small office, no industrial process pollution").
  // Optional; rendered only when present.
  notMaterialReason?: string;
  inputs: InputDefinition[];
  formula: string;
  // Current-year values keyed by input name. Always has the same keys as
  // `inputs` — the addInput / removeInput / updateInput reducers keep this
  // invariant. A future migration to per-year history would wrap this in
  // `Record<year, Record<name, Value>>` (see persist.ts for the upgrade
  // path).
  values: Record<string, Value>;
  // Per-variable raw weights for the slider section under the formula.
  // Keys are the identifiers referenced in the RHS of `score = …`
  // (extracted at render time via `extractScoreVars`). Values are
  // 0..MAX_WEIGHT — normalized to percentage shares at display time, the
  // same shape Strategy uses for materiality weights. Variables not
  // present in this map default to MAX_WEIGHT in the UI, matching
  // Strategy's "everything matters equally" reset.
  //
  // Stale keys (variables removed from the formula) are kept in the map
  // so a temporary edit to `score = …` doesn't wipe out a user's chosen
  // weight; only the variables currently extracted from the formula
  // surface as sliders.
  weights: Record<string, number>;
  // Per-variable judgement range for the slider section. Each component
  // referenced in `score = …` carries a [min, max] interval the user
  // declares as "what counts as bad / good for this variable on its
  // native scale" — the system normalizes the variable's evaluated
  // value to 0..100 within that range before mixing components into the
  // rating. Variables without an entry here default to [0, 100], the
  // identity for already-normalized components.
  ranges: Record<string, VarRange>;
}

// Per-type "blank" used when adding a new input or repairing a missing
// value at sanitize time. Numeric default of 0 means a freshly-added
// numeric input shows an empty-looking field that doesn't crash arithmetic
// against existing inputs (the formula may still divide-by-zero, which
// produces an honest evaluation error rather than a silent bad number).
export function defaultValueFor(type: InputType): Value {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

function valueMatchesType(v: unknown, type: InputType): v is Value {
  if (type === "number") return typeof v === "number" && Number.isFinite(v);
  if (type === "boolean") return typeof v === "boolean";
  return typeof v === "string";
}

interface MetricsState {
  byId: Record<string, MetricConfig>;
}

// Seed for Energy Consumption — calibrated for an Italian SME doing
// light manufacturing (~200 MWh/year, ~1.5M€ revenue), the kind of
// company GRI 302 / ESRS E1 reporting tooling actually targets. The
// formula computes the four components on their *natural scale*
// (fractions, kWh/€, boolean); the judgement of "what counts as good"
// lives in the per-component ranges below — no `* 100` rescaling in
// the formula because the range does that work.
//
// Components:
// - `renewable_share`  — fraction of consumed energy from renewable
//                        sources. Higher is better.
// - `reduction`        — year-over-year reduction in absolute kWh.
//                        Higher is better; an increase clamps to 0
//                        (saturated at the bad end of the rating).
// - `iso_50001`        — boolean: presence of ISO 50001 energy
//                        management certification. SMEs rarely have
//                        it (it's expensive to maintain) — a clear
//                        improvement lever rather than a baseline.
// - `energy_intensity` — kWh per € of revenue. *Lower* is better,
//                        encoded with `−` in the score expression so
//                        the slider engine inverts the normalized
//                        contribution.
//
// Seed values represent an SME that's started its energy transition
// (30% renewables, 7% YoY reduction, decent intensity) but hasn't
// gone for the ISO 50001 cert — leaving an obvious "what if I
// certify?" lever for the user to pull. With midpoint weights the
// rating works out to roughly 41 / 100.
// Seed for CO₂ Emissions — calibrated for the same Italian SME profile
// as the energy seed (~200 MWh/year, ~1.5M€ revenue, light
// manufacturing). The formula again computes components on their
// natural scale and lets the per-component ranges do the "what's good"
// judgement work.
//
// Components:
// - `reduction`         — year-over-year reduction in absolute tCO₂
//                          (Scope 1 + 2). Higher is better; an
//                          increase clamps to 0.
// - `sbti_validated`    — boolean: presence of SBTi (Science Based
//                          Targets) validation. SMEs rarely have it;
//                          a clear improvement lever.
// - `carbon_intensity`  — kgCO₂ per € of revenue (computed in the
//                          formula as `total * 1000 / revenue` so
//                          the value sits in a range humans can read,
//                          ~0.02–0.2 instead of 2e-5–2e-4 tCO₂/€).
//                          *Lower* is better, encoded with `−` in the
//                          score expression.
//
// Seed values: an SME with Scope 1 ≈ 50 tCO₂ (gas heating, small
// fleet) and Scope 2 ≈ 40 tCO₂ (location-based, ~200 MWh × 0.2
// kgCO₂/kWh after the energy seed's renewable share), down 14% from
// last year, no SBTi commitment yet. With midpoint weights this lands
// around 60/100 — a reasonable starting point given the strong YoY
// trend and decent intensity, with the missing SBTi as the obvious
// improvement lever.
const CO2_EMISSIONS_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "scope1_tco2", type: "number", label: "Scope 1 emissions (tCO₂eq/year)" },
    {
      name: "scope2_tco2",
      type: "number",
      label: "Scope 2 emissions (tCO₂eq/year, location-based)",
    },
    {
      name: "tco2_previous",
      type: "number",
      label: "Previous year total (tCO₂eq/year)",
    },
    {
      name: "revenue_eur",
      type: "number",
      label: "Annual revenue (€)",
    },
    {
      name: "sbti_validated",
      type: "boolean",
      label: "SBTi-validated reduction targets",
    },
  ],
  formula: `total_emissions = scope1_tco2 + scope2_tco2
reduction = (tco2_previous - total_emissions) / tco2_previous
carbon_intensity = total_emissions * 1000 / revenue_eur

score = reduction + sbti_validated - carbon_intensity`,
  values: {
    scope1_tco2: 50,
    scope2_tco2: 40,
    tco2_previous: 105,
    revenue_eur: 1500000,
    sbti_validated: false,
  },
  weights: {},
  // - reduction [0, 0.1]: same scale as the energy seed — 10% YoY is
  //   "excellent" for an SME without a major retrofit; values above
  //   that saturate, increases clamp to 0.
  // - sbti_validated [0, 1]: identity for the boolean.
  // - carbon_intensity [0.02, 0.2] kgCO₂/€: 0.02 is "world-class
  //   efficient" for light manufacturing/services, 0.2 is "definitely
  //   too emission-heavy" (above the typical Italian SME-industry
  //   median around 0.15). The `−` sign in the score expression
  //   inverts the contribution.
  ranges: {
    reduction: { min: 0, max: 0.1 },
    sbti_validated: { min: 0, max: 1 },
    carbon_intensity: { min: 0.02, max: 0.2 },
  },
};

// Seed for Water Usage — same Italian SME profile (~1.5M€ revenue,
// light manufacturing). GRI 303 / ESRS E3 indicators expressed on
// their natural scale; the per-component ranges encode the "what
// counts as good" judgement.
//
// Components:
// - `recycle_share`           — fraction of water demand met by
//                                recycled / reused water. Higher is
//                                better.
// - `reduction`               — year-over-year reduction in absolute
//                                m³. Higher is better; an increase
//                                clamps to 0.
// - `water_management_plan`   — boolean: formal water management
//                                plan in place (a leading indicator —
//                                companies with a plan tend to
//                                improve year-on-year, those without
//                                rarely do).
// - `water_intensity`         — litres per € of revenue (formula
//                                multiplies m³ × 1000 so the value
//                                sits in a readable range, ~0.5–3
//                                instead of 5e-4–3e-3 m³/€). *Lower*
//                                is better, encoded with `−` in the
//                                score expression.
//
// Seed values: 2000 m³/year (a typical light-manufacturing SME — ~5
// m³/day for cleaning, sanitary, light process water), 10% recycled
// (the floor most SMEs achieve without a dedicated water system),
// 9% YoY reduction, no formal water management plan. With midpoint
// weights this lands around 44/100.
const WATER_USAGE_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "m3_total", type: "number", label: "Total water withdrawal (m³/year)" },
    {
      name: "m3_recycled",
      type: "number",
      label: "Recycled / reused water (m³/year)",
    },
    {
      name: "m3_previous",
      type: "number",
      label: "Previous year withdrawal (m³/year)",
    },
    {
      name: "revenue_eur",
      type: "number",
      label: "Annual revenue (€)",
    },
    {
      name: "water_management_plan",
      type: "boolean",
      label: "Formal water management plan",
    },
  ],
  formula: `recycle_share = m3_recycled / m3_total
reduction = (m3_previous - m3_total) / m3_previous
water_intensity = m3_total * 1000 / revenue_eur

score = recycle_share + reduction + water_management_plan - water_intensity`,
  values: {
    m3_total: 2000,
    m3_recycled: 200,
    m3_previous: 2200,
    revenue_eur: 1500000,
    water_management_plan: false,
  },
  weights: {},
  // - recycle_share [0, 0.5]: 50% recycling is "excellent" for an SME
  //   (above ~30% requires real reuse infrastructure — closed loops,
  //   greywater, treated process water).
  // - reduction [0, 0.1]: same scale as energy/CO₂ seeds — 10% YoY
  //   is "excellent" without a major retrofit; increases clamp to 0.
  // - water_management_plan [0, 1]: identity for the boolean.
  // - water_intensity [0.5, 3] L/€: 0.5 is "world-class water-thrifty"
  //   (services, dry assembly), 3 is "definitely too water-heavy" for
  //   light manufacturing (real water-intensive sectors — beverage,
  //   textile, paper — sit above this and would warrant their own
  //   sector range). The `−` sign in the score expression inverts
  //   the contribution.
  ranges: {
    recycle_share: { min: 0, max: 0.5 },
    reduction: { min: 0, max: 0.1 },
    water_management_plan: { min: 0, max: 1 },
    water_intensity: { min: 0.5, max: 3 },
  },
};

// Seed for Waste Management — same Italian SME profile (~1.5M€
// revenue, light manufacturing). GRI 306 / ESRS E5 (resource use and
// circular economy) indicators expressed on their natural scale; the
// per-component ranges encode the "what counts as good" judgement.
//
// Components:
// - `recycle_share`     — fraction of waste diverted from disposal
//                          (recycled, reused, recovered). Higher is
//                          better. The headline circular-economy metric.
// - `reduction`         — year-over-year reduction in absolute tonnes.
//                          Higher is better; an increase clamps to 0.
// - `iso_14001`         — boolean: ISO 14001 environmental management
//                          certification. The umbrella standard most
//                          relevant to waste/disposal practices for an
//                          SME without a sector-specific cert.
// - `hazardous_share`   — fraction of total waste classified as
//                          hazardous (oils, solvents, batteries, …).
//                          *Lower* is better, encoded with `−`.
// - `waste_intensity`   — kg of waste per € of revenue (formula
//                          multiplies tonnes × 1000 so the value sits
//                          in a readable range, ~0.005–0.05 instead of
//                          5e-6–5e-5 t/€). *Lower* is better, encoded
//                          with `−`.
//
// Seed values: 25 t/year (~70 kg/day for ~50 employees — typical
// light manufacturing), 60% diverted (Italian municipal collection
// already covers paper/plastic/glass; 60% reflects that baseline plus
// some shop-floor sorting), 4% hazardous (light manufacturing has
// some chemicals/oils but isn't a heavy emitter), 7% YoY reduction,
// no ISO 14001. With midpoint weights this lands around 59/100 — a
// decent starting point with the missing certification and the small
// hazardous-waste fraction as obvious improvement levers.
const WASTE_MANAGEMENT_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "t_total", type: "number", label: "Total waste generated (t/year)" },
    {
      name: "t_diverted",
      type: "number",
      label: "Diverted from disposal (recycled / recovered, t/year)",
    },
    {
      name: "t_hazardous",
      type: "number",
      label: "Hazardous waste (t/year)",
    },
    {
      name: "t_previous",
      type: "number",
      label: "Previous year total (t/year)",
    },
    {
      name: "revenue_eur",
      type: "number",
      label: "Annual revenue (€)",
    },
    {
      name: "iso_14001",
      type: "boolean",
      label: "ISO 14001 certification",
    },
  ],
  formula: `recycle_share = t_diverted / t_total
hazardous_share = t_hazardous / t_total
reduction = (t_previous - t_total) / t_previous
waste_intensity = t_total * 1000 / revenue_eur

score = recycle_share + reduction + iso_14001 - hazardous_share - waste_intensity`,
  values: {
    t_total: 25,
    t_diverted: 15,
    t_hazardous: 1,
    t_previous: 27,
    revenue_eur: 1500000,
    iso_14001: false,
  },
  weights: {},
  // - recycle_share [0, 0.7]: 70% diverted is "excellent" for an SME
  //   (above that requires real circular-economy investment — closed
  //   loops with suppliers, take-back schemes).
  // - reduction [0, 0.1]: same scale as the other environmental
  //   seeds — 10% YoY is "excellent"; increases clamp to 0.
  // - iso_14001 [0, 1]: identity for the boolean.
  // - hazardous_share [0, 0.1]: 10% hazardous is the upper bound for
  //   light manufacturing (real chemical/electroplating SMEs sit
  //   higher and would warrant a sector-specific range). The `−`
  //   sign in the score expression inverts the contribution.
  // - waste_intensity [0.005, 0.05] kg/€: 0.005 is service-business
  //   territory (5 g of waste per € of revenue), 0.05 is heavy
  //   light-manufacturing. The `−` sign inverts the contribution.
  ranges: {
    recycle_share: { min: 0, max: 0.7 },
    reduction: { min: 0, max: 0.1 },
    iso_14001: { min: 0, max: 1 },
    hazardous_share: { min: 0, max: 0.1 },
    waste_intensity: { min: 0.005, max: 0.05 },
  },
};

// Seed for Human Resources — same Italian SME profile (~50
// employees, ~1.5M€ revenue, light manufacturing). GRI 401
// (Employment) / GRI 404 (Training & Education) / ESRS S1 (Own
// workforce) indicators.
//
// Diversity / inclusion deliberately *not* covered here — they live
// in the sibling `social/inclusivity` metric so the two pages don't
// double-count the same component.
//
// Components:
// - `training_intensity`  — average training hours per employee per
//                            year. Higher is better.
// - `permanent_share`     — fraction of headcount on permanent
//                            contracts (vs fixed-term / agency).
//                            Higher is better — Italian labour market
//                            shorthand for job security.
// - `welfare_program`     — boolean: structured welfare/benefits
//                            programme beyond statutory minimum
//                            (meal vouchers, supplementary pension,
//                            health, smart-working policy, …).
// - `turnover_rate`       — voluntary leavers / total headcount over
//                            the year. *Lower* is better, encoded
//                            with `−` in the score expression.
//
// Seed values: 50 employees, 5 voluntary leavers (10% turnover —
// typical for Italian manufacturing SMEs, around the sector median),
// 800 training hours total → 16 h per employee (above the Italian
// SME average of ~10–15 h, below the "investing-in-people" mark of
// 30+), 42 permanent contracts (84% — typical IT manufacturing
// share), no formal welfare programme. With midpoint weights this
// lands around 46/100 — decent baseline with welfare and training
// volume as the obvious improvement levers.
const HUMAN_RESOURCES_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "total_employees", type: "number", label: "Total headcount" },
    {
      name: "voluntary_leavers",
      type: "number",
      label: "Voluntary leavers (year)",
    },
    {
      name: "training_hours_total",
      type: "number",
      label: "Total training hours delivered (year)",
    },
    {
      name: "permanent_contracts",
      type: "number",
      label: "Employees on permanent contracts",
    },
    {
      name: "welfare_program",
      type: "boolean",
      label: "Structured welfare / benefits programme",
    },
  ],
  formula: `turnover_rate = voluntary_leavers / total_employees
training_intensity = training_hours_total / total_employees
permanent_share = permanent_contracts / total_employees

score = training_intensity + permanent_share + welfare_program - turnover_rate`,
  values: {
    total_employees: 50,
    voluntary_leavers: 5,
    training_hours_total: 800,
    permanent_contracts: 42,
    welfare_program: false,
  },
  weights: {},
  // - training_intensity [0, 40] h/employee/year: 0 = no training,
  //   40 = "investing-in-people" territory (well above the Italian
  //   SME ~10–15 h average; the 40h ceiling tracks the legal
  //   minimum for many regulated roles, a reasonable "excellent" cap).
  // - permanent_share [0, 1]: identity for the fraction. 100% =
  //   all permanent, 0% = all temporary.
  // - welfare_program [0, 1]: identity for the boolean.
  // - turnover_rate [0, 0.25]: 0% = no voluntary departures, 25% =
  //   chronic retention problem (well above the typical Italian
  //   manufacturing SME rate of 10–15%). The `−` sign in the score
  //   expression inverts the contribution.
  ranges: {
    training_intensity: { min: 0, max: 40 },
    permanent_share: { min: 0, max: 1 },
    welfare_program: { min: 0, max: 1 },
    turnover_rate: { min: 0, max: 0.25 },
  },
};

// Seed for Inclusivity — same Italian SME profile (~50 employees,
// light manufacturing, historically male-dominated sector). GRI 405
// (Diversity & Equal Opportunity) / ESRS S1-9, S1-16 indicators.
//
// Components:
// - `women_share`             — fraction of women in total headcount.
//                                Higher is better.
// - `women_leadership_share`  — fraction of women in leadership
//                                roles (managers + supervisors).
//                                Tracked separately from headcount
//                                because parity at entry doesn't
//                                imply parity at the top — the
//                                "glass ceiling" gap is what ESG
//                                ratings actually measure.
// - `disability_share`        — fraction of employees with
//                                disabilities. Italy's Legge 68/99
//                                mandates 7% for >50-employee
//                                companies, 2 people for 36–50.
// - `inclusive_policy`        — boolean: formal inclusion / equal
//                                opportunity policy beyond statutory
//                                minimum (anti-harassment training,
//                                accessibility plan, parental
//                                support, …).
// - `gender_pay_gap`          — adjusted gender pay gap as a fraction
//                                (e.g. 0.08 = women paid 8% less
//                                than men for comparable roles —
//                                ESRS S1-16 reporting basis). *Lower*
//                                is better, encoded with `−`.
//
// Seed values: 50 employees, 15 women (30% — typical for Italian
// light manufacturing), 10 leadership roles with 2 women (20%
// leadership share, the "glass ceiling" the ESG rating should flag),
// 2 employees with disabilities (4% — borderline-compliant for the
// 36–50 bracket, would fail the 7% mandate above 50), 8% gender pay
// gap (around the Italian manufacturing median), no formal inclusion
// policy. With midpoint weights this lands around 43/100 — inclusion
// policy and leadership representation are the obvious improvement
// levers.
const INCLUSIVITY_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "total_employees", type: "number", label: "Total headcount" },
    {
      name: "women_total",
      type: "number",
      label: "Women in workforce",
    },
    {
      name: "leadership_count",
      type: "number",
      label: "Leadership roles (managers + supervisors)",
    },
    {
      name: "women_leadership",
      type: "number",
      label: "Women in leadership",
    },
    {
      name: "disabled_employees",
      type: "number",
      label: "Employees with disabilities",
    },
    {
      name: "gender_pay_gap",
      type: "number",
      label: "Adjusted gender pay gap (fraction, e.g. 0.08 = 8%)",
    },
    {
      name: "inclusive_policy",
      type: "boolean",
      label: "Formal inclusion / equal-opportunity policy",
    },
  ],
  formula: `women_share = women_total / total_employees
women_leadership_share = women_leadership / leadership_count
disability_share = disabled_employees / total_employees

score = women_share + women_leadership_share + disability_share + inclusive_policy - gender_pay_gap`,
  values: {
    total_employees: 50,
    women_total: 15,
    leadership_count: 10,
    women_leadership: 2,
    disabled_employees: 2,
    gender_pay_gap: 0.08,
    inclusive_policy: false,
  },
  weights: {},
  // - women_share [0, 0.5]: 50% = parity, the natural 100% endpoint.
  //   The rating saturates above parity rather than rewarding
  //   over-representation — the goal is balance, not inversion.
  // - women_leadership_share [0, 0.5]: same parity logic for
  //   leadership.
  // - disability_share [0, 0.07]: Italy's Legge 68/99 quota for
  //   >50-employee companies is the natural 100% endpoint.
  // - inclusive_policy [0, 1]: identity for the boolean.
  // - gender_pay_gap [0, 0.2]: 0% = no gap (the goal), 20% = the
  //   upper bound where the rating saturates at the bad end.
  //   Italy's average sits around 5–10% adjusted; sectors above
  //   20% flag a structural problem rather than measurement noise.
  //   The `−` sign in the score expression inverts the contribution.
  ranges: {
    women_share: { min: 0, max: 0.5 },
    women_leadership_share: { min: 0, max: 0.5 },
    disability_share: { min: 0, max: 0.07 },
    inclusive_policy: { min: 0, max: 1 },
    gender_pay_gap: { min: 0, max: 0.2 },
  },
};

// Seed for Health and Safety — same Italian SME profile (~50
// employees, ~100k hours/year, light manufacturing). GRI 403
// (Occupational Health & Safety) / ESRS S1-14 indicators, framed
// against the D.Lgs. 81/08 baseline (mandatory safety training,
// risk assessment, RLS — Rappresentante dei Lavoratori per la
// Sicurezza).
//
// Components:
// - `incident_rate`              — recordable incidents per million
//                                   hours worked (LTIFR — the EU
//                                   convention; multiply by 1e6 in
//                                   the formula so the value sits in
//                                   a readable range, ~5–30 instead
//                                   of 5e-6–3e-5). *Lower* is better,
//                                   encoded with `−`.
// - `lost_day_intensity`         — days lost to injury per employee
//                                   per year. *Lower* is better,
//                                   encoded with `−`.
// - `safety_training_intensity`  — hours of safety-specific training
//                                   per employee per year. Tracked
//                                   separately from HR's general
//                                   training because D.Lgs. 81/08
//                                   mandates a per-risk-class minimum
//                                   (4–16 h) and the materiality is
//                                   different. Higher is better.
// - `iso_45001`                  — boolean: ISO 45001 OHS management
//                                   certification. SMEs rarely have
//                                   it; clear improvement lever.
//
// Seed values: ~50 employees doing 100k hours/year (40h × 50 weeks ×
// 50 emp), 2 recordable incidents (LTIFR 20 — sector median for
// Italian light manufacturing), 30 lost days, 600 hours of safety
// training (12 h/employee — above the 8 h mandatory minimum for
// medium-risk roles), no ISO 45001. With midpoint weights this
// lands around 45/100 — driven down by the average incident rate
// and the missing certification.
const HEALTH_AND_SAFETY_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "total_employees", type: "number", label: "Total headcount" },
    {
      name: "hours_worked",
      type: "number",
      label: "Total hours worked (year)",
    },
    {
      name: "recordable_incidents",
      type: "number",
      label: "Recordable incidents (year)",
    },
    {
      name: "lost_days",
      type: "number",
      label: "Days lost to injury (year)",
    },
    {
      name: "safety_training_hours",
      type: "number",
      label: "Safety-specific training hours (year)",
    },
    {
      name: "iso_45001",
      type: "boolean",
      label: "ISO 45001 certification",
    },
  ],
  formula: `incident_rate = recordable_incidents / hours_worked * 1000000
lost_day_intensity = lost_days / total_employees
safety_training_intensity = safety_training_hours / total_employees

score = safety_training_intensity + iso_45001 - incident_rate - lost_day_intensity`,
  values: {
    total_employees: 50,
    hours_worked: 100000,
    recordable_incidents: 2,
    lost_days: 30,
    safety_training_hours: 600,
    iso_45001: false,
  },
  weights: {},
  // - safety_training_intensity [0, 16] h/employee/year: D.Lgs.
  //   81/08 caps mandatory training at 16 h for high-risk roles —
  //   a reasonable "excellent" ceiling for light manufacturing.
  //   0 would be illegal; the rating just saturates at the bad end.
  // - iso_45001 [0, 1]: identity for the boolean.
  // - incident_rate [0, 30] per million hours: 0 = no incidents,
  //   30 ≈ Italian manufacturing-sector average for LTIFR. The `−`
  //   sign in the score expression inverts the contribution.
  // - lost_day_intensity [0, 2] days/employee/year: 0 = none, 2 =
  //   serious problem (a workforce losing 100 person-days/year is
  //   either chronic injury or a major event). The `−` sign
  //   inverts the contribution.
  ranges: {
    safety_training_intensity: { min: 0, max: 16 },
    iso_45001: { min: 0, max: 1 },
    incident_rate: { min: 0, max: 30 },
    lost_day_intensity: { min: 0, max: 2 },
  },
};

// Seed for CDA (Consiglio di Amministrazione — Board of Directors) —
// same Italian SME profile (~50 employees, family-controlled, not
// listed). GRI 2-9..2-21 (Governance) / ESRS G1 indicators, framed
// against the Italian regulatory landscape: Codice di Autodisciplina
// for independence, Legge Golfo-Mosca / 120/2011 for gender quotas
// (binding only for listed and state-controlled companies — non-listed
// SMEs are evaluated against the *recommendation*, not the mandate).
//
// Components:
// - `independence_share`     — fraction of independent directors.
//                               Higher is better.
// - `women_share`            — fraction of women on the board.
//                               Higher is better.
// - `board_meetings`         — board meetings held per year. Higher
//                               is better — a board meeting twice a
//                               year is a rubber-stamp; 12+ signals
//                               active oversight.
// - `ceo_chair_separated`    — boolean: CEO and Chairman are
//                               distinct people. Joint roles are the
//                               default in family-controlled SMEs and
//                               a recurring weakness in ESG ratings.
//
// Audit committee, conflict-of-interest disclosures, and
// whistleblowing channels deliberately *not* covered here — they
// live in the sibling `governance/ethics-and-compliance` metric to
// avoid double-counting.
//
// Seed values: 5-member board (typical SRL), 1 independent (20% —
// usually a friendly external advisor), 1 woman (20% — well below
// the listed-company benchmark), 5 meetings/year, CEO and Chair
// overlapping (the founder holds both roles — the most common
// Italian SME pattern). With midpoint weights this lands around
// 36/100 — governance is the area where Italian SMEs typically
// score lowest, and the seed reflects that honestly. Splitting the
// CEO/Chair roles is the highest-impact lever.
const CDA_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "board_size", type: "number", label: "Board members (total)" },
    {
      name: "independent_directors",
      type: "number",
      label: "Independent directors",
    },
    {
      name: "women_directors",
      type: "number",
      label: "Women on the board",
    },
    {
      name: "board_meetings",
      type: "number",
      label: "Board meetings per year",
    },
    {
      name: "ceo_chair_separated",
      type: "boolean",
      label: "CEO and Chairman are different people",
    },
  ],
  formula: `independence_share = independent_directors / board_size
women_share = women_directors / board_size

score = independence_share + women_share + board_meetings + ceo_chair_separated`,
  values: {
    board_size: 5,
    independent_directors: 1,
    women_directors: 1,
    board_meetings: 5,
    ceo_chair_separated: false,
  },
  weights: {},
  // - independence_share [0, 0.4]: the Italian Codice di
  //   Autodisciplina recommends ≥1/3 independent for non-listed
  //   companies (≥1/2 for listed). 40% is set as the "excellent"
  //   ceiling for the SME context — anything above that is rare and
  //   the rating saturates.
  // - women_share [0, 0.4]: Legge Golfo-Mosca / 120/2011 mandates
  //   40% gender balance for listed and state-controlled boards.
  //   Used as the recommendation benchmark for non-listed SMEs.
  // - board_meetings [0, 12]: 0–1 meetings = nominal/dormant board,
  //   12 = monthly cadence (active oversight). Above that the
  //   marginal benefit drops off, so the rating saturates.
  // - ceo_chair_separated [0, 1]: identity for the boolean.
  ranges: {
    independence_share: { min: 0, max: 0.4 },
    women_share: { min: 0, max: 0.4 },
    board_meetings: { min: 0, max: 12 },
    ceo_chair_separated: { min: 0, max: 1 },
  },
};

// Seed for Ethics and Compliance — same Italian SME profile (~50
// employees). GRI 205 (Anti-corruption) / GRI 2-23..2-27 (Policy
// commitments & complaint mechanisms) / ESRS G1 (Business conduct)
// indicators, framed against the Italian compliance landscape:
// D.Lgs. 231/2001 (corporate liability — the "Modello 231" is the
// signal control framework), D.Lgs. 24/2023 implementing EU
// Directive 2019/1937 (whistleblowing — mandatory for >50-employee
// companies since Dec 2023).
//
// Components:
// - `code_of_ethics`               — boolean: written code of ethics
//                                     adopted and disseminated. The
//                                     entry-level governance control.
// - `model_231`                    — boolean: D.Lgs. 231/2001
//                                     organisational model adopted.
//                                     Optional for SMEs but the
//                                     single biggest signal of due
//                                     diligence — large customers
//                                     increasingly require it.
// - `whistleblowing_channel`       — boolean: D.Lgs. 24/2023
//                                     internal reporting channel in
//                                     place. Mandatory above 50
//                                     employees; SMEs at the
//                                     threshold often implement it
//                                     proactively.
// - `compliance_training_intensity` — anti-corruption / compliance
//                                     training hours per employee
//                                     per year. Higher is better.
// - `compliance_violations`        — documented sanctions / fines /
//                                     formal compliance findings in
//                                     the year. *Lower* is better,
//                                     encoded with `−`.
//
// Seed values: an SME just past the 50-employee threshold that has
// implemented the basics (codice etico, whistleblowing) but not the
// heavier Modello 231, with minimal compliance training (1 h per
// employee — the "we did the mandatory briefing" floor) and no
// documented violations. With midpoint weights this lands around
// 65/100 — higher than the other governance seeds because the
// regulatory baseline forces a couple of "yes" answers, with
// Modello 231 and meaningful training as the obvious levers.
const ETHICS_AND_COMPLIANCE_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    {
      name: "total_employees",
      type: "number",
      label: "Total headcount",
    },
    {
      name: "compliance_training_hours",
      type: "number",
      label: "Anti-corruption / compliance training hours (year)",
    },
    {
      name: "compliance_violations",
      type: "number",
      label: "Documented violations / sanctions (year)",
    },
    {
      name: "code_of_ethics",
      type: "boolean",
      label: "Written code of ethics in force",
    },
    {
      name: "model_231",
      type: "boolean",
      label: "Modello 231 adopted (D.Lgs. 231/2001)",
    },
    {
      name: "whistleblowing_channel",
      type: "boolean",
      label: "Whistleblowing channel in place (D.Lgs. 24/2023)",
    },
  ],
  formula: `compliance_training_intensity = compliance_training_hours / total_employees

score = code_of_ethics + model_231 + whistleblowing_channel + compliance_training_intensity - compliance_violations`,
  values: {
    total_employees: 50,
    compliance_training_hours: 50,
    compliance_violations: 0,
    code_of_ethics: true,
    model_231: false,
    whistleblowing_channel: true,
  },
  weights: {},
  // - code_of_ethics, model_231, whistleblowing_channel [0, 1]:
  //   identity for the booleans.
  // - compliance_training_intensity [0, 4] h/employee/year: 0 =
  //   nothing, 4 = a meaningful annual programme (compliance topics
  //   don't need the volume that safety training does — half a day
  //   per year is already substantive).
  // - compliance_violations [0, 3]: 0 = clean year, 3 = chronic
  //   pattern (one-off fines happen even to compliant companies; a
  //   sustained run of three signals a structural issue). The `−`
  //   sign in the score expression inverts the contribution.
  ranges: {
    code_of_ethics: { min: 0, max: 1 },
    model_231: { min: 0, max: 1 },
    whistleblowing_channel: { min: 0, max: 1 },
    compliance_training_intensity: { min: 0, max: 4 },
    compliance_violations: { min: 0, max: 3 },
  },
};

// Seed for Supply Chain — same Italian SME profile (~50 employees,
// light manufacturing, ~60 active suppliers). GRI 308 (Supplier
// Environmental Assessment) / GRI 414 (Supplier Social Assessment) /
// ESRS G1-2 (management of relationships with suppliers) indicators,
// plus the geographic-concentration dimension that maps to the
// EU's emerging due-diligence regime (CSDDD, CBAM).
//
// Components:
// - `screened_share`        — fraction of *critical* suppliers
//                              (the ones representing ~80% of spend
//                              by Pareto) that have been ESG-evaluated
//                              via questionnaire or audit. Higher is
//                              better.
// - `local_share`           — fraction of total suppliers based in
//                              Italy or the EU. Higher is better —
//                              shorter physical chain, common
//                              regulatory framework, lower CBAM
//                              exposure for ex-EU carbon-intensive
//                              imports.
// - `audit_intensity`       — on-site supplier audits performed per
//                              year, divided by critical suppliers.
//                              0.1 = one audit covering 10% of
//                              critical suppliers; 1.0 = every
//                              critical supplier audited annually.
// - `supplier_code_adopted` — boolean: formal supplier code of
//                              conduct in force (signed by suppliers
//                              as part of contracting).
//
// Seed values: 60 active suppliers, 10 critical (the Pareto top),
// 3 of those ESG-screened (30% — typical SME starting point), 45
// EU-based (75%), 1 on-site audit in the year, no formal supplier
// code of conduct. With midpoint weights this lands around 29/100 —
// the lowest seed in the app, reflecting that supply-chain due
// diligence is genuinely the weakest ESG area for Italian SMEs.
// Adopting a supplier code and formalising critical-supplier
// screening are the high-impact levers.
const SUPPLY_CHAIN_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "total_suppliers", type: "number", label: "Total active suppliers" },
    {
      name: "critical_suppliers",
      type: "number",
      label: "Critical suppliers (~80% of spend)",
    },
    {
      name: "esg_screened_suppliers",
      type: "number",
      label: "ESG-screened critical suppliers",
    },
    {
      name: "local_suppliers",
      type: "number",
      label: "Suppliers based in Italy or EU",
    },
    {
      name: "supplier_audits",
      type: "number",
      label: "On-site supplier audits performed (year)",
    },
    {
      name: "supplier_code_adopted",
      type: "boolean",
      label: "Formal supplier code of conduct in force",
    },
  ],
  formula: `screened_share = esg_screened_suppliers / critical_suppliers
local_share = local_suppliers / total_suppliers
audit_intensity = supplier_audits / critical_suppliers

score = screened_share + local_share + audit_intensity + supplier_code_adopted`,
  values: {
    total_suppliers: 60,
    critical_suppliers: 10,
    esg_screened_suppliers: 3,
    local_suppliers: 45,
    supplier_audits: 1,
    supplier_code_adopted: false,
  },
  weights: {},
  // - screened_share [0, 1]: identity. 100% critical suppliers
  //   ESG-evaluated is the natural ceiling.
  // - local_share [0, 1]: identity. 100% EU is rare in practice
  //   (some inputs are intrinsically global) but the rating
  //   saturates at the boundary, so over-estimating the ceiling
  //   doesn't distort the seed.
  // - audit_intensity [0, 1]: 1 audit per critical supplier per
  //   year is "excellent" oversight; below 0.5 most critical
  //   suppliers go years without a visit.
  // - supplier_code_adopted [0, 1]: identity for the boolean.
  ranges: {
    screened_share: { min: 0, max: 1 },
    local_share: { min: 0, max: 1 },
    audit_intensity: { min: 0, max: 1 },
    supplier_code_adopted: { min: 0, max: 1 },
  },
};

const ENERGY_CONSUMPTION_SEED: MetricConfig = {
  isMaterial: true,
  inputs: [
    { name: "kwh_total", type: "number", label: "Total consumption (kWh/year)" },
    {
      name: "kwh_renewable",
      type: "number",
      label: "From renewable sources (kWh/year)",
    },
    {
      name: "kwh_previous",
      type: "number",
      label: "Previous year consumption (kWh/year)",
    },
    {
      name: "revenue_eur",
      type: "number",
      label: "Annual revenue (€)",
    },
    {
      name: "iso_50001",
      type: "boolean",
      label: "ISO 50001 certification",
    },
  ],
  formula: `renewable_share = kwh_renewable / kwh_total
reduction = (kwh_previous - kwh_total) / kwh_previous
energy_intensity = kwh_total / revenue_eur

score = renewable_share + reduction + iso_50001 - energy_intensity`,
  values: {
    kwh_total: 200000,
    kwh_renewable: 60000,
    kwh_previous: 215000,
    revenue_eur: 1500000,
    iso_50001: false,
  },
  weights: {},
  // Per-component judgement scales calibrated for the SME context:
  // - renewable_share [0, 1]: identity for the fraction.
  // - reduction [0, 0.1]: 10% YoY reduction is "excellent" for an
  //   SME (sustained YoY drops above this are rare without major
  //   retrofit projects). A negative reduction (consumption up)
  //   clamps to 0%.
  // - iso_50001 [0, 1]: identity for the boolean.
  // - energy_intensity [0.05, 0.3] kWh/€: 0.05 is "world-class
  //   efficient" for light manufacturing/services, 0.3 is
  //   "definitely too consumption-heavy". The `−` sign in the score
  //   expression inverts the contribution so the lower endpoint
  //   reads as the high-rating one.
  ranges: {
    renewable_share: { min: 0, max: 1 },
    reduction: { min: 0, max: 0.1 },
    iso_50001: { min: 0, max: 1 },
    energy_intensity: { min: 0.05, max: 0.3 },
  },
};

const EMPTY_CONFIG: MetricConfig = {
  isMaterial: true,
  inputs: [],
  formula: "",
  values: {},
  weights: {},
  ranges: {},
};

// Seeds for ESRS topics that the Italian light-manufacturing SME
// profile defaults to "not material" — but with a *full* editor body
// pre-filled, not an empty shell. The user who flips the switch from
// "not material" to "material" lands on a populated assessment they
// can adjust, instead of a blank form they have to design from
// scratch. The reasons are written from the SME perspective; a
// services company or a chemicals company would flip a different
// subset, but they too get a starting point rather than nothing.

// ESRS E2 — air/water/soil pollution, REACH SVHC use, regulatory
// violations. Light manufacturing typically has modest VOC emissions
// (solvents, cleaning), some wastewater that may or may not be
// pre-treated, and minimal hazardous substance use.
const POLLUTION_SEED: MetricConfig = {
  isMaterial: false,
  notMaterialReason:
    "Not material: light manufacturing, no significant emissions to air, water, or soil reported under E-PRTR thresholds.",
  inputs: [
    { name: "voc_kg", type: "number", label: "VOC emissions to air (kg/year)" },
    {
      name: "wastewater_m3",
      type: "number",
      label: "Wastewater discharged (m³/year)",
    },
    {
      name: "wastewater_treated_m3",
      type: "number",
      label: "Wastewater pre-treated before discharge (m³/year)",
    },
    {
      name: "svhc_substances_count",
      type: "number",
      label: "REACH SVHC substances in use (count)",
    },
    {
      name: "pollution_violations",
      type: "number",
      label: "Documented pollution-related sanctions (year)",
    },
    {
      name: "revenue_eur",
      type: "number",
      label: "Annual revenue (€)",
    },
  ],
  formula: `voc_intensity = voc_kg / revenue_eur * 1000
treated_share = wastewater_treated_m3 / wastewater_m3

score = treated_share - voc_intensity - svhc_substances_count - pollution_violations`,
  values: {
    voc_kg: 100,
    wastewater_m3: 1500,
    wastewater_treated_m3: 1200,
    svhc_substances_count: 1,
    pollution_violations: 0,
    revenue_eur: 1500000,
  },
  weights: {},
  ranges: {
    treated_share: { min: 0, max: 1 },
    voc_intensity: { min: 0, max: 0.3 },
    svhc_substances_count: { min: 0, max: 5 },
    pollution_violations: { min: 0, max: 3 },
  },
};

// ESRS E4 — biodiversity & ecosystems. For a small industrial site
// the meaningful dimensions are land use intensity (sealed vs
// permeable area), distance from protected areas, and presence of
// any biodiversity-positive practice.
const BIODIVERSITY_SEED: MetricConfig = {
  isMaterial: false,
  notMaterialReason:
    "Not material: operations confined to existing industrial premises, no land use in or near protected areas.",
  inputs: [
    { name: "site_area_m2", type: "number", label: "Total site area (m²)" },
    {
      name: "green_area_m2",
      type: "number",
      label: "Permeable / vegetated area (m²)",
    },
    {
      name: "nearest_protected_km",
      type: "number",
      label: "Distance to nearest protected area (km)",
    },
    {
      name: "biodiversity_plan",
      type: "boolean",
      label: "Formal biodiversity action plan",
    },
  ],
  formula: `green_share = green_area_m2 / site_area_m2

score = green_share + nearest_protected_km + biodiversity_plan`,
  values: {
    site_area_m2: 3000,
    green_area_m2: 600,
    nearest_protected_km: 8,
    biodiversity_plan: false,
  },
  weights: {},
  // - green_share [0, 0.4]: 40% permeable area is "excellent" for
  //   an industrial site (above that requires real green-roof or
  //   bioswale investment).
  // - nearest_protected_km [0, 5]: 5+ km from a Natura 2000 / IUCN
  //   protected area is the threshold above which direct ecological
  //   risk is considered low; the rating saturates there.
  // - biodiversity_plan [0, 1]: identity for the boolean.
  ranges: {
    green_share: { min: 0, max: 0.4 },
    nearest_protected_km: { min: 0, max: 5 },
    biodiversity_plan: { min: 0, max: 1 },
  },
};

// ESRS S2 — workers in the value chain (NOT the company's own
// workforce — that's S1). The headline indicators are supplier
// labor-rights screening, contractual human-rights clauses, and
// disclosed incidents. Distinct from `governance/supply-chain`
// (which covers ESG screening generally) — S2 is specifically
// labor practices in upstream tiers.
const VALUE_CHAIN_WORKERS_SEED: MetricConfig = {
  isMaterial: false,
  notMaterialReason:
    "Covered indirectly via the Supply Chain metric (ESRS G1-2). A standalone S2 assessment would require value-chain mapping beyond current scope.",
  inputs: [
    {
      name: "tier1_suppliers",
      type: "number",
      label: "Tier-1 suppliers (direct contracts)",
    },
    {
      name: "tier1_labor_audited",
      type: "number",
      label: "Tier-1 suppliers audited for labor practices",
    },
    {
      name: "human_rights_clause",
      type: "boolean",
      label: "Human-rights clause in standard supplier contracts",
    },
    {
      name: "living_wage_committed",
      type: "boolean",
      label: "Public living-wage commitment in supply chain",
    },
    {
      name: "labor_violations_disclosed",
      type: "number",
      label: "Disclosed labor incidents in supply chain (year)",
    },
  ],
  formula: `labor_audit_share = tier1_labor_audited / tier1_suppliers

score = labor_audit_share + human_rights_clause + living_wage_committed - labor_violations_disclosed`,
  values: {
    tier1_suppliers: 30,
    tier1_labor_audited: 2,
    human_rights_clause: false,
    living_wage_committed: false,
    labor_violations_disclosed: 0,
  },
  weights: {},
  ranges: {
    labor_audit_share: { min: 0, max: 1 },
    human_rights_clause: { min: 0, max: 1 },
    living_wage_committed: { min: 0, max: 1 },
    labor_violations_disclosed: { min: 0, max: 3 },
  },
};

// ESRS S3 — affected communities. For an industrial SME the
// "community" is the neighbourhood and municipality near the site:
// local hires, civic investment, formal grievance channel, complaint
// volume.
const AFFECTED_COMMUNITIES_SEED: MetricConfig = {
  isMaterial: false,
  notMaterialReason:
    "Not material: no operational impact on local communities outside standard noise / traffic from the production site.",
  inputs: [
    { name: "total_employees", type: "number", label: "Total headcount" },
    {
      name: "local_employees",
      type: "number",
      label: "Employees living within ~30 km of the site",
    },
    {
      name: "community_investments_eur",
      type: "number",
      label: "Local sponsorships / donations (€/year)",
    },
    {
      name: "revenue_eur",
      type: "number",
      label: "Annual revenue (€)",
    },
    {
      name: "community_grievance_channel",
      type: "boolean",
      label: "Formal community grievance channel in place",
    },
    {
      name: "community_complaints",
      type: "number",
      label: "Community complaints received (year)",
    },
  ],
  formula: `local_share = local_employees / total_employees
community_giving_intensity = community_investments_eur / revenue_eur * 100

score = local_share + community_giving_intensity + community_grievance_channel - community_complaints`,
  values: {
    total_employees: 50,
    local_employees: 35,
    community_investments_eur: 5000,
    revenue_eur: 1500000,
    community_grievance_channel: false,
    community_complaints: 0,
  },
  weights: {},
  // - local_share [0, 1]: identity. 100% local hires = strongest
  //   community embedding; no penalty for non-local because remote
  //   work / commuting is normal.
  // - community_giving_intensity [0, 1] % of revenue: 1% of
  //   revenue donated locally is generous for an SME (Italian
  //   industrial SMEs typically donate 0.1–0.3%).
  // - community_grievance_channel [0, 1]: identity.
  // - community_complaints [0, 3]: 0 = clean, 3 = chronic friction
  //   with the neighbourhood.
  ranges: {
    local_share: { min: 0, max: 1 },
    community_giving_intensity: { min: 0, max: 1 },
    community_grievance_channel: { min: 0, max: 1 },
    community_complaints: { min: 0, max: 3 },
  },
};

// ESRS S4 — consumers and end-users. For B2B-only operations this
// is typically not material; if assessed, the meaningful dimensions
// are complaint rate, product safety incidents, and the existence of
// a privacy/GDPR programme.
const CONSUMERS_END_USERS_SEED: MetricConfig = {
  isMaterial: false,
  notMaterialReason:
    "Not material: B2B-only sales, no direct relationship with end-users; product-safety obligations handled at the customer-contract level.",
  inputs: [
    {
      name: "customers_count",
      type: "number",
      label: "Active customers (year)",
    },
    {
      name: "complaints_received",
      type: "number",
      label: "Customer complaints received (year)",
    },
    {
      name: "safety_incidents",
      type: "number",
      label: "Product-safety incidents / recalls (year)",
    },
    {
      name: "privacy_program",
      type: "boolean",
      label: "Formal privacy / GDPR programme beyond statutory minimum",
    },
  ],
  formula: `complaint_intensity = complaints_received / customers_count * 100

score = privacy_program - complaint_intensity - safety_incidents`,
  values: {
    customers_count: 80,
    complaints_received: 3,
    safety_incidents: 0,
    privacy_program: false,
  },
  weights: {},
  // - privacy_program [0, 1]: identity.
  // - complaint_intensity [0, 5] % of customers: 5% complaint rate
  //   is a structural problem; 0 is a clean year.
  // - safety_incidents [0, 3]: a single incident is a serious
  //   signal in a B2B context; 3 is a pattern.
  ranges: {
    privacy_program: { min: 0, max: 1 },
    complaint_intensity: { min: 0, max: 5 },
    safety_incidents: { min: 0, max: 3 },
  },
};

// Build the factory state at call time (not as a frozen module-level
// constant) so that callers — the slice's initialState, `resetMetric`, and
// `persist.ts`'s sanitize — each get a fresh independent copy that can be
// mutated by reducers without aliasing.
export function defaultMetricsState(): MetricsState {
  const byId: Record<string, MetricConfig> = {};
  // Per-metric seeds keyed by registry id. Anything not in this map
  // gets `EMPTY_CONFIG` — the placeholder pages render the editor
  // shell with no inputs/formula, ready for the user to fill in (or
  // for us to add a domain-specific seed in a future commit).
  const SEEDS: Record<string, MetricConfig> = {
    "environmental/energy-consumption": ENERGY_CONSUMPTION_SEED,
    "environmental/co2-emissions": CO2_EMISSIONS_SEED,
    "environmental/water-usage": WATER_USAGE_SEED,
    "environmental/waste-management": WASTE_MANAGEMENT_SEED,
    "social/human-resources": HUMAN_RESOURCES_SEED,
    "social/inclusivity": INCLUSIVITY_SEED,
    "social/health-and-safety": HEALTH_AND_SAFETY_SEED,
    "governance/cda": CDA_SEED,
    "governance/ethics-and-compliance": ETHICS_AND_COMPLIANCE_SEED,
    "governance/supply-chain": SUPPLY_CHAIN_SEED,
    // ESRS topics the SME profile defaults to "not material". Each
    // ships with a *full* editor body — inputs, formula, ranges,
    // values — so the user who flips the materiality toggle on lands
    // on a populated assessment instead of a blank form. Until then
    // they surface only in Reporting CSRD's "Topics not assessed"
    // section with the reason from the seed.
    "environmental/pollution": POLLUTION_SEED,
    "environmental/biodiversity": BIODIVERSITY_SEED,
    "social/value-chain-workers": VALUE_CHAIN_WORKERS_SEED,
    "social/affected-communities": AFFECTED_COMMUNITIES_SEED,
    "social/consumers-end-users": CONSUMERS_END_USERS_SEED,
  };
  for (const m of SCORED_METRICS) {
    const seed = SEEDS[m.id];
    byId[m.id] = structuredClone(seed ?? EMPTY_CONFIG);
  }
  return { byId };
}

const initialState: MetricsState = defaultMetricsState();

const slice = createSlice({
  name: "metrics",
  initialState,
  reducers: {
    addInput: (
      state,
      action: PayloadAction<{ metricId: string; input: InputDefinition }>,
    ) => {
      const { metricId, input } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      // Reject duplicate names. The UI also validates before dispatching,
      // but the slice keeps the invariant so a buggy caller can't corrupt
      // the input list.
      if (m.inputs.some((i) => i.name === input.name)) return;
      m.inputs.push(input);
      // Keep values in lockstep with inputs — every defined input has a
      // value, even if it's the type-default zero. Saves the editor and
      // the formula evaluator from carrying "may not exist" branches.
      m.values[input.name] = defaultValueFor(input.type);
    },

    removeInput: (
      state,
      action: PayloadAction<{ metricId: string; name: string }>,
    ) => {
      const { metricId, name } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      m.inputs = m.inputs.filter((i) => i.name !== name);
      delete m.values[name];
    },

    updateInput: (
      state,
      action: PayloadAction<{
        metricId: string;
        name: string;
        patch: Partial<InputDefinition>;
      }>,
    ) => {
      const { metricId, name, patch } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      const idx = m.inputs.findIndex((i) => i.name === name);
      if (idx < 0) return;
      // Renaming: the new name must still be unique within the metric. If
      // it isn't, the rename silently fails — UI catches this earlier.
      if (patch.name !== undefined && patch.name !== name) {
        if (m.inputs.some((i) => i.name === patch.name)) return;
        // Move the value to the new key; the old key would otherwise
        // dangle in `values` and pollute the formula's scope as an
        // identifier the user can no longer see in the editor.
        m.values[patch.name] = m.values[name];
        delete m.values[name];
      }
      const next = { ...m.inputs[idx], ...patch };
      // Type changed: re-seed the value to its new type's default rather
      // than coerce. Coercing "0" → false → 0 chains nonsense; a clean
      // reset is more predictable.
      if (patch.type !== undefined && patch.type !== m.inputs[idx].type) {
        m.values[next.name] = defaultValueFor(next.type);
      }
      m.inputs[idx] = next;
    },

    setInputValue: (
      state,
      action: PayloadAction<{ metricId: string; name: string; value: Value }>,
    ) => {
      const { metricId, name, value } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      const def = m.inputs.find((i) => i.name === name);
      if (!def) return;
      if (!valueMatchesType(value, def.type)) return;
      m.values[name] = value;
    },

    setFormula: (
      state,
      action: PayloadAction<{ metricId: string; formula: string }>,
    ) => {
      const { metricId, formula } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      m.formula = formula;
    },

    setVarWeight: (
      state,
      action: PayloadAction<{
        metricId: string;
        name: string;
        weight: number;
      }>,
    ) => {
      const { metricId, name, weight } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      // The slice clamps to a sane integer range. The UI's slider also
      // bounds the value, but a buggy or programmatic dispatch shouldn't
      // be able to put garbage into the persisted state.
      if (!Number.isFinite(weight)) return;
      m.weights[name] = Math.max(0, Math.min(255, Math.round(weight)));
    },

    setVarRange: (
      state,
      action: PayloadAction<{
        metricId: string;
        name: string;
        min: number;
        max: number;
      }>,
    ) => {
      const { metricId, name, min, max } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      // Reject NaN / Infinity. Allow min === max (degenerate range —
      // the score computation treats it as a step function) and even
      // min > max (the user might be mid-edit; the score computation
      // is defensive). The UI is expected to coordinate the two fields
      // sensibly, but we don't enforce ordering at the slice boundary.
      if (!Number.isFinite(min) || !Number.isFinite(max)) return;
      m.ranges[name] = { min, max };
    },

    resetMetric: (state, action: PayloadAction<{ metricId: string }>) => {
      const { metricId } = action.payload;
      const factory = defaultMetricsState();
      if (factory.byId[metricId]) {
        state.byId[metricId] = factory.byId[metricId];
      }
    },

    setMaterial: (
      state,
      action: PayloadAction<{ metricId: string; isMaterial: boolean }>,
    ) => {
      const { metricId, isMaterial } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      m.isMaterial = isMaterial;
      // Flipping back to material clears any stale not-material reason —
      // keeping it would let an old "Not material: …" string resurface
      // in the report if the user toggles a second time. The reason is
      // tied to the not-material *decision*, so it lives only as long
      // as the decision does.
      if (isMaterial) m.notMaterialReason = undefined;
    },

    setNotMaterialReason: (
      state,
      action: PayloadAction<{ metricId: string; reason: string }>,
    ) => {
      const { metricId, reason } = action.payload;
      const m = state.byId[metricId];
      if (!m) return;
      // Only stored when the metric is actually flagged not-material —
      // a stray dispatch on a material metric would otherwise plant a
      // dormant reason that resurfaces on the next toggle.
      if (!m.isMaterial) m.notMaterialReason = reason;
    },
  },
});

export const {
  addInput,
  removeInput,
  updateInput,
  setInputValue,
  setFormula,
  setVarWeight,
  setVarRange,
  resetMetric,
  setMaterial,
  setNotMaterialReason,
} = slice.actions;
export default slice.reducer;
