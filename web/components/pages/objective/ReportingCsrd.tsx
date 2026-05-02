"use client";

import { useMemo, type CSSProperties } from "react";
import { useTheme } from "@/lib/themes";
import { useAppSelector } from "@/store/hooks";
import { SCORED_METRICS } from "@/lib/scoring/config";
import {
  computeMetricRating,
  normalizeToPercent,
  DEFAULT_RANGE,
  DEFAULT_VAR_WEIGHT,
} from "@/lib/scoring/rating";
import {
  compile,
  evaluate,
  extractScoreVars,
  type Value,
} from "@/lib/formula";
import { AREAS, type WindowArea } from "@/lib/windows/registry";
import type { MetricConfig, VarRange } from "@/store/slices/metricsSlice";
import { COLORS } from "@/lib/themes/tokens";

const SCORED_AREAS: WindowArea[] = AREAS.filter((a) => a !== "Objective");

// ESRS metadata now lives on the registry entry itself — see
// `WindowDefinition.esrs`. Sourced from there (not duplicated here)
// so a metric's standards anchor is defined once. The "Topics not
// assessed" disclosure block is derived dynamically from the metrics
// flagged `isMaterial: false` in the slice — no separate hardcoded
// list to keep in sync.

type ReportStyles = ReturnType<
  typeof useTheme
>["theme"]["pages"]["objective"]["reportingCsrd"];

interface ComponentBreakdown {
  name: string;
  sign: 1 | -1;
  range: VarRange;
  raw: number | null;
  rawDisplay: string;
  normalized: number | null;
  weight: number;
  share: number;
}

interface MetricEvalData {
  config: MetricConfig;
  rating: number | null;
  components: ComponentBreakdown[];
}

// Walks a metric's formula AST to produce everything the report
// needs about it: the rating, the per-component breakdown (raw value,
// normalized %, share % of slider weight). Returns `null` when the
// formula doesn't compile or evaluate — the report renders a "no data"
// row in that case rather than skipping silently.
function evaluateMetric(config: MetricConfig): MetricEvalData {
  const compiled = compile(config.formula);
  if (!compiled.ok) return { config, rating: null, components: [] };
  const evalRes = evaluate(compiled.value, config.values);
  if (!evalRes.ok) return { config, rating: null, components: [] };
  const scoreVars = extractScoreVars(compiled.value);
  const totalWeight = scoreVars.reduce(
    (sum, { name }) =>
      sum + (config.weights[name] ?? DEFAULT_VAR_WEIGHT),
    0,
  );
  const components: ComponentBreakdown[] = scoreVars.map(({ name, sign }) => {
    const range = config.ranges[name] ?? DEFAULT_RANGE;
    const weight = config.weights[name] ?? DEFAULT_VAR_WEIGHT;
    const share = totalWeight === 0 ? 0 : (weight / totalWeight) * 100;
    const v = evalRes.value.scope[name];
    let raw: number | null = null;
    if (typeof v === "number") raw = v;
    else if (typeof v === "boolean") raw = v ? 1 : 0;
    let normalized: number | null = null;
    if (raw !== null) {
      let n = normalizeToPercent(raw, range);
      if (sign === -1) n = 100 - n;
      normalized = n;
    }
    return {
      name,
      sign,
      range,
      raw,
      rawDisplay: formatComponentRaw(v),
      normalized,
      weight,
      share,
    };
  });
  return {
    config,
    rating: computeMetricRating(config),
    components,
  };
}

function formatComponentRaw(v: Value | undefined): string {
  if (v === undefined) return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("en-US");
    return v.toFixed(4).replace(/\.?0+$/, "");
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return JSON.stringify(v);
}

function formatInputValue(v: Value | undefined): string {
  if (v === undefined) return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("en-US");
    return v.toFixed(2).replace(/\.?0+$/, "");
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return v;
}

function formatRange(r: VarRange): string {
  return `${formatNumber(r.min)} – ${formatNumber(r.max)}`;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, "");
}

// One-sentence factual narrative per metric. Picks the highest- and
// lowest-normalized components (after sign inversion, so "lowest" is
// the worst-performing dimension regardless of formula sign). When
// the metric has no usable components, falls back to a bare score line.
function narrativeFor(data: MetricEvalData): string {
  if (data.rating === null) {
    return "No rating available — the formula does not currently evaluate.";
  }
  const usable = data.components.filter((c) => c.normalized !== null);
  if (usable.length === 0) {
    return `Score: ${Math.round(data.rating)}/100.`;
  }
  const top = usable.reduce((a, b) =>
    (a.normalized ?? -Infinity) >= (b.normalized ?? -Infinity) ? a : b,
  );
  const bottom = usable.reduce((a, b) =>
    (a.normalized ?? Infinity) <= (b.normalized ?? Infinity) ? a : b,
  );
  if (top.name === bottom.name) {
    return `Score: ${Math.round(data.rating)}/100. Single component: ${top.name} (${Math.round(top.normalized!)}% normalized).`;
  }
  return `Score: ${Math.round(data.rating)}/100. Highest contribution: ${top.name} (${Math.round(top.normalized!)}% normalized). Greatest improvement opportunity: ${bottom.name} (${Math.round(bottom.normalized!)}%).`;
}

// Aggregates rating × materiality for a list of metric evaluations.
// Same null-skip semantics as `RatingEsg`'s aggregator: a metric with
// no rating is removed from both the numerator and the denominator
// rather than zeroing out the overall.
function aggregateRows(
  rows: { rating: number | null; weight: number }[],
): { rating: number | null; weight: number } {
  let weighted = 0;
  let total = 0;
  for (const r of rows) {
    if (r.rating === null) continue;
    weighted += r.rating * r.weight;
    total += r.weight;
  }
  if (total === 0) return { rating: null, weight: 0 };
  return { rating: weighted / total, weight: total };
}

export default function ReportingCsrd() {
  const { theme } = useTheme();
  const styles = theme.pages.objective.reportingCsrd;
  const metricsById = useAppSelector((s) => s.metrics.byId);
  const materiality = useAppSelector((s) => s.esg.weights);

  // Compute everything once. Cheap (sub-ms per metric on the seed
  // formulas) and it lets the children read from a single computed
  // structure rather than each repeating the compile/evaluate dance.
  const reportRows = useMemo(() => {
    return SCORED_METRICS.map((m) => {
      const data = evaluateMetric(metricsById[m.id]);
      const weight = materiality[m.id] ?? 0;
      return { meta: m, data, weight };
    });
  }, [metricsById, materiality]);

  // Split the rows up-front by materiality. Material rows feed the
  // executive summary, the materiality table, and the per-area
  // sections. Non-material rows feed the "Topics not assessed"
  // disclosure block — each carries the user's free-form reason.
  const materialRows = useMemo(
    () => reportRows.filter((r) => r.data.config.isMaterial),
    [reportRows],
  );
  const notAssessedRows = useMemo(
    () => reportRows.filter((r) => !r.data.config.isMaterial),
    [reportRows],
  );

  const totalMateriality = materialRows.reduce(
    (sum, r) => (r.data.rating === null ? sum : sum + r.weight),
    0,
  );

  const overall = useMemo(
    () => aggregateRows(materialRows.map((r) => ({ rating: r.data.rating, weight: r.weight }))),
    [materialRows],
  );

  const areaSummaries = useMemo(() => {
    return SCORED_AREAS.map((area) => {
      const inArea = materialRows.filter((r) => r.meta.area === area);
      const agg = aggregateRows(
        inArea.map((r) => ({ rating: r.data.rating, weight: r.weight })),
      );
      return { area, ...agg };
    });
  }, [materialRows]);

  const generatedAt = useMemo(() => {
    // Locale-stable ISO date — the report should read the same regardless
    // of where the user is. Time-of-day deliberately omitted — the report
    // is "as of <date>", not a transactional log.
    return new Date().toISOString().slice(0, 10);
  }, []);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="printable-report" style={styles.page}>
      <header style={styles.docHeader}>
        <h1 style={styles.docTitle}>Sustainability Statement</h1>
        <p style={styles.docSubtitle}>
          CSRD-style self-assessment · for FY 2024 · generated{" "}
          {generatedAt}
        </p>
      </header>

      <section style={styles.summary} aria-label="Executive summary">
        <h2 style={styles.h2}>Executive summary</h2>
        <div style={styles.summaryGrid}>
          <div style={styles.summaryOverall}>
            <span style={styles.summaryOverallLabel}>Overall ESG</span>
            {overall.rating !== null ? (
              <span style={styles.summaryOverallValue}>
                {Math.round(overall.rating)} / 100
              </span>
            ) : (
              <span style={styles.summaryOverallEmpty}>—</span>
            )}
          </div>
          <ul style={styles.summaryAreaList}>
            {areaSummaries.map((a) => (
              <li key={a.area} style={styles.summaryAreaItem}>
                <span style={styles.summaryAreaLabel}>{a.area}</span>
                <span style={styles.summaryAreaValue}>
                  {a.rating !== null ? `${Math.round(a.rating)} / 100` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section style={styles.materialityBlock} aria-label="Materiality assessment">
        <h2 style={styles.h2}>Materiality assessment</h2>
        <p style={styles.bodyText}>
          The user-defined materiality weights from the <em>Strategy</em>{" "}
          page allocate the following share of the overall ESG score
          across the assessed topics. Topics flagged not material in
          their own editor — together with their reason — appear in
          the sub-section below.
        </p>
        <table style={styles.materialityTable}>
          <thead>
            <tr>
              <th style={styles.thLeft}>Topic</th>
              <th style={styles.thLeft}>ESRS</th>
              <th style={styles.thRight}>Weight</th>
              <th style={styles.thRight}>Share of total</th>
            </tr>
          </thead>
          <tbody>
            {materialRows.map(({ meta, weight }) => {
              const share =
                totalMateriality === 0
                  ? 0
                  : (weight / totalMateriality) * 100;
              return (
                <tr key={meta.id}>
                  <td style={styles.tdLeft}>{meta.title}</td>
                  <td style={styles.tdLeftMono}>{meta.esrs?.code ?? "—"}</td>
                  <td style={styles.tdRightMono}>{weight}</td>
                  <td style={styles.tdRightMono}>{share.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 style={styles.h3}>Topics not assessed</h3>
        {notAssessedRows.length === 0 ? (
          <p style={styles.bodyText}>
            <em>
              All ESRS topics in scope have been assessed. No topic was
              declared not material.
            </em>
          </p>
        ) : (
          <table style={styles.notAssessedTable}>
            <tbody>
              {notAssessedRows.map(({ meta, data }) => (
                <tr key={meta.id}>
                  <td style={styles.tdLeftMono}>{meta.esrs?.code ?? "—"}</td>
                  <td style={styles.tdLeft}>
                    {meta.esrs?.topic ?? meta.title}
                  </td>
                  <td style={styles.tdLeftItalic}>
                    {data.config.notMaterialReason ?? "Not material."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {SCORED_AREAS.map((area) => {
        const inArea = materialRows.filter((r) => r.meta.area === area);
        if (inArea.length === 0) return null;
        return (
          <section key={area} style={styles.areaBlock}>
            <h2 style={styles.h2}>{area}</h2>
            {inArea.map(({ meta, data, weight }) => (
              <MetricSection
                key={meta.id}
                title={meta.title}
                esrs={meta.esrs}
                weight={weight}
                totalMateriality={totalMateriality}
                data={data}
                styles={styles}
              />
            ))}
          </section>
        );
      })}

      <footer style={styles.footer}>
        <p style={styles.disclaimer}>
          <strong>Disclaimer.</strong> This document is a stylized
          self-assessment generated for demonstration purposes. It is
          not an audited CSRD sustainability statement and does not
          substitute for the official reporting obligations under
          Directive (EU) 2022/2464 and the European Sustainability
          Reporting Standards. Methodologies, ranges, and weights are
          set by the user; the underlying ratings reflect those choices,
          not an external verification.
        </p>
        <button
          type="button"
          onClick={handlePrint}
          style={styles.printButton}
          className="no-print"
        >
          Print / Save as PDF
        </button>
      </footer>
    </div>
  );
}

function MetricSection({
  title,
  esrs,
  weight,
  totalMateriality,
  data,
  styles,
}: {
  title: string;
  esrs: { code: string; topic: string } | undefined;
  weight: number;
  totalMateriality: number;
  data: MetricEvalData;
  styles: ReportStyles;
}) {
  const share =
    totalMateriality === 0 ? 0 : (weight / totalMateriality) * 100;
  return (
    <article style={styles.metricBlock}>
      <header style={styles.metricHeader}>
        <h3 style={styles.metricTitle}>
          {title} <span style={styles.metricCode}>· {esrs?.code ?? "—"}</span>
        </h3>
        <p style={styles.metricSubtitle}>
          {esrs?.topic ?? "—"} · materiality {share.toFixed(1)}% (raw{" "}
          {weight})
        </p>
      </header>

      <div style={styles.metricRatingRow}>
        <RatingBar rating={data.rating} label={title} styles={styles} />
        {data.rating !== null ? (
          <span style={styles.metricRatingValue}>
            {Math.round(data.rating)} / 100
          </span>
        ) : (
          <span style={styles.metricRatingEmpty}>—</span>
        )}
      </div>

      <p style={styles.metricNarrative}>{narrativeFor(data)}</p>

      <h4 style={styles.h4}>Inputs</h4>
      <dl style={styles.inputsList}>
        {data.config.inputs.map((inp) => (
          <div key={inp.name} style={styles.inputsRow}>
            <dt style={styles.inputsLabel}>
              {inp.label ?? inp.name}{" "}
              <span style={styles.inputsName}>({inp.name})</span>
            </dt>
            <dd style={styles.inputsValue}>
              {formatInputValue(data.config.values[inp.name])}
            </dd>
          </div>
        ))}
      </dl>

      <h4 style={styles.h4}>Methodology — formula</h4>
      <pre style={styles.formulaBlock}>{data.config.formula}</pre>

      {data.components.length > 0 && (
        <>
          <h4 style={styles.h4}>Components</h4>
          <table style={styles.componentsTable}>
            <thead>
              <tr>
                <th style={styles.thLeft}>Component</th>
                <th style={styles.thLeft}>Direction</th>
                <th style={styles.thLeft}>Range</th>
                <th style={styles.thRight}>Raw</th>
                <th style={styles.thRight}>Normalized</th>
                <th style={styles.thRight}>Share</th>
              </tr>
            </thead>
            <tbody>
              {data.components.map((c) => (
                <tr key={c.name}>
                  <td style={styles.tdLeftMono}>{c.name}</td>
                  <td style={styles.tdLeft}>
                    {c.sign === 1 ? "Higher = better" : "Lower = better"}
                  </td>
                  <td style={styles.tdLeftMono}>{formatRange(c.range)}</td>
                  <td style={styles.tdRightMono}>{c.rawDisplay}</td>
                  <td style={styles.tdRightMono}>
                    {c.normalized !== null
                      ? `${Math.round(c.normalized)}%`
                      : "—"}
                  </td>
                  <td style={styles.tdRightMono}>{c.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

// Same banded fill as `RatingEsg.tsx` — keeps the visual encoding
// consistent across the two read-only views so the user transfers
// the colour vocabulary without re-learning.
//
// The fill is rendered as an SVG `<rect>` rather than a div with a
// background colour so it prints as content (like text) regardless
// of the browser's "Background graphics" / ink-saving toggle in the
// print dialog. Background-paint surfaces are stripped by default
// in Chromium / Edge unless the user enables "Background graphics"
// AND the page declares `print-color-adjust: exact` — and even then,
// the user's manual toggle wins. SVG fills bypass that machinery
// entirely. The wrapper div still carries the sunken bevel via
// box-shadow; that's purely decorative, so losing it in ink-saving
// mode is acceptable.
function RatingBar({
  rating,
  label,
  styles,
}: {
  rating: number | null;
  // Used as the meter's accessible name (`aria-label`). Required by
  // WCAG / axe — `role="meter"` without a label is treated as
  // unidentified by screen readers ("meter, 42 of 100" with no idea
  // *what* is being measured). Pass the metric title from the
  // parent so the assistive tech reads "Energy Consumption rating,
  // 42 of 100".
  label: string;
  styles: ReportStyles;
}) {
  if (rating === null) {
    return (
      <div style={styles.bar} aria-hidden>
        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ display: "block" }}
        >
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={COLORS.gray500}
            fillOpacity="0.2"
          />
        </svg>
      </div>
    );
  }
  const fillColor =
    rating < 40
      ? COLORS.syntaxScore
      : rating < 70
        ? COLORS.syntaxString
        : COLORS.syntaxNumber;
  return (
    <div
      style={styles.bar}
      role="meter"
      aria-label={`${label} rating`}
      aria-valuenow={Math.round(rating)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <rect x="0" y="0" width={`${rating}%`} height="100%" fill={fillColor} />
      </svg>
    </div>
  );
}
