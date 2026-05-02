"use client";

import { useMemo } from "react";
import { useTheme } from "@/lib/themes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openWindow } from "@/store/slices/windowsSlice";
import { SCORED_METRICS } from "@/lib/scoring/config";
import { computeMetricRating } from "@/lib/scoring/rating";
import { AREAS, type WindowArea } from "@/lib/windows/registry";
import { COLORS } from "@/lib/themes/tokens";

const SCORED_AREAS: WindowArea[] = AREAS.filter((a) => a !== "Objective");

type EsgStyles = ReturnType<typeof useTheme>["theme"]["pages"]["objective"]["ratingEsg"];

interface MetricRow {
  id: string;
  title: string;
  area: WindowArea;
  rating: number | null;
  weight: number;
  // `true` when the user has flagged the metric not material in the
  // editor. The aggregator already drops it via `rating: null`, but
  // the row needs to render differently — italic "not assessed"
  // marker rather than the "—" used for "formula didn't evaluate".
  isMaterial: boolean;
}

// Materiality-weighted average over a subset of metrics. Metrics whose
// rating is `null` (formula error, no usable score variables and no
// fallback constant) are silently skipped — both numerator and
// denominator. The alternative (propagating null upward) would make
// the overall ESG score vanish whenever the user is mid-edit on any
// single metric, which feels punitive for what should be an "always
// shows the best-effort number" panel.
function aggregate(rows: MetricRow[]): { rating: number | null; weight: number } {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of rows) {
    if (r.rating === null) continue;
    weightedSum += r.rating * r.weight;
    totalWeight += r.weight;
  }
  if (totalWeight === 0) return { rating: null, weight: 0 };
  return { rating: weightedSum / totalWeight, weight: totalWeight };
}

export default function RatingEsg() {
  const { theme } = useTheme();
  const styles = theme.pages.objective.ratingEsg;
  const dispatch = useAppDispatch();
  const metricsById = useAppSelector((s) => s.metrics.byId);
  const materiality = useAppSelector((s) => s.esg.weights);

  // Compute every metric's rating once per render. Cheap — `compile`
  // and `evaluate` together run sub-millisecond on the seed formulas.
  // Memoised on the slice references so unrelated re-renders (a
  // sibling window opening / closing) don't re-do the work.
  const rows = useMemo<MetricRow[]>(() => {
    return SCORED_METRICS.map((m) => ({
      id: m.id,
      title: m.title,
      area: m.area,
      rating: computeMetricRating(metricsById[m.id]),
      weight: materiality[m.id] ?? 0,
      isMaterial: metricsById[m.id]?.isMaterial ?? true,
    }));
  }, [metricsById, materiality]);

  const overall = useMemo(() => aggregate(rows), [rows]);
  const totalMateriality = overall.weight;

  // Per-area aggregate. The numerator/denominator accounting matches
  // the overall — same metrics dropped, same weighting — so the area
  // sub-scores and the overall reconcile cleanly when the user does
  // the math by hand.
  const areaSummaries = useMemo(() => {
    return SCORED_AREAS.map((area) => {
      const areaRows = rows.filter((r) => r.area === area);
      const agg = aggregate(areaRows);
      return {
        area,
        rating: agg.rating,
        weight: agg.weight,
        share: totalMateriality === 0 ? 0 : (agg.weight / totalMateriality) * 100,
      };
    });
  }, [rows, totalMateriality]);

  const openStrategy = () => dispatch(openWindow("objective/strategy"));

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Rating ESG</h1>
        <p style={styles.helper}>
          The materiality-weighted aggregate of every scored metric.
          Each metric&apos;s rating comes from its own editor; the
          materiality weights come from the <em>Strategy</em> page.
          Metrics whose formula doesn&apos;t evaluate are silently
          skipped from the average.
        </p>
      </header>

      <section style={styles.summaryPanel} aria-label="Overall ESG summary">
        <div style={styles.overallBlock}>
          <span style={styles.overallLabel}>Overall ESG</span>
          {overall.rating !== null ? (
            <span style={styles.overallValue}>
              {Math.round(overall.rating)} / 100
            </span>
          ) : (
            <span style={styles.overallEmpty}>—</span>
          )}
        </div>

        <div style={styles.areaSummary}>
          {areaSummaries.map((a) => (
            <AreaSummaryRow key={a.area} styles={styles} {...a} />
          ))}
        </div>
      </section>

      {SCORED_AREAS.map((area) => (
        <fieldset key={area} style={styles.fieldset}>
          <legend style={styles.legend}>{area}</legend>
          {rows
            .filter((r) => r.area === area)
            .map((r) => (
              <MetricRowView
                key={r.id}
                row={r}
                totalMateriality={totalMateriality}
                styles={styles}
              />
            ))}
        </fieldset>
      ))}

      <p style={styles.footer}>
        Adjust materiality weights in the{" "}
        <button type="button" onClick={openStrategy} style={styles.footerLink}>
          Strategy
        </button>{" "}
        page; edit a metric&apos;s formula or sliders in its own window.
      </p>
    </div>
  );
}

function AreaSummaryRow({
  styles,
  area,
  rating,
  share,
}: {
  styles: EsgStyles;
  area: WindowArea;
  rating: number | null;
  weight: number;
  share: number;
}) {
  return (
    <>
      <span style={styles.areaSummaryLabel}>{area}</span>
      <span aria-hidden />
      {rating !== null ? (
        <span style={styles.areaSummaryValue}>{Math.round(rating)}</span>
      ) : (
        <span style={styles.areaSummaryEmpty}>—</span>
      )}
      <span style={styles.areaSummaryShare}>{share.toFixed(0)}%</span>
    </>
  );
}

function MetricRowView({
  row,
  totalMateriality,
  styles,
}: {
  row: MetricRow;
  totalMateriality: number;
  styles: EsgStyles;
}) {
  const share =
    totalMateriality === 0 ? 0 : (row.weight / totalMateriality) * 100;
  // Three render states:
  //   * not material → italic "not assessed", no bar, no share %
  //     (the metric is out of scope, share-of-materiality doesn't apply)
  //   * material + has rating → normal row with bar + value + share
  //   * material + no rating  → "—" (formula error, mid-edit, etc.)
  if (!row.isMaterial) {
    // Single-content row: title on the left, italic "not assessed"
    // spanning the bar/rating/share columns (`grid-column: 2 / -1`).
    // The wide span avoids the 56-px rating column wrapping the
    // text onto two lines, and reads cleanly as one statement
    // about the metric instead of three half-empty cells.
    return (
      <div style={styles.row}>
        <span style={styles.rowLabel} title={row.title}>
          {row.title}
        </span>
        <span style={styles.notAssessedNote}>not assessed</span>
      </div>
    );
  }
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel} title={row.title}>
        {row.title}
      </span>
      <RatingBar rating={row.rating} label={row.title} styles={styles} />
      {row.rating !== null ? (
        <span style={styles.rating}>{Math.round(row.rating)} / 100</span>
      ) : (
        <span style={styles.ratingEmpty}>—</span>
      )}
      <span style={styles.share}>{share.toFixed(1)}%</span>
    </div>
  );
}

// Banded fill: red below 40, orange 40–70, green above 70. The
// thresholds align with how ESG ratings are typically described in
// the field ("CCC/B/BB" vs "A/AA" vs "AAA"-ish). Not a deep
// methodological claim — just visual shorthand so the bar communicates
// "good/middling/poor" at a glance.
//
// Rendered as SVG (matches the version in `ReportingCsrd.tsx`) so a
// future "save as PNG" or print export of this page wouldn't lose
// the colour-encoded bar to the browser's ink-saving optimisations.
function RatingBar({
  rating,
  label,
  styles,
}: {
  rating: number | null;
  // Used as the meter's accessible name. See `RatingBar` in
  // `ReportingCsrd.tsx` for the full rationale.
  label: string;
  styles: EsgStyles;
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
