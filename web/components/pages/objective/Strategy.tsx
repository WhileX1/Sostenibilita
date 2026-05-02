"use client";

import { useTheme } from "@/lib/themes";
import { useButtonState } from "@/lib/ui/useButtonState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetWeights, setWeight } from "@/store/slices/esgSlice";
import { MAX_WEIGHT, SCORED_METRICS } from "@/lib/scoring/config";
import { AREAS, type WindowArea } from "@/lib/windows/registry";

const SCORED_AREAS: WindowArea[] = AREAS.filter((a) => a !== "Objective");

export default function Strategy() {
  const { theme } = useTheme();
  const styles = theme.pages.objective.strategy;
  const weights = useAppSelector((s) => s.esg.weights);
  const metricsById = useAppSelector((s) => s.metrics.byId);
  const dispatch = useAppDispatch();
  const reset = useButtonState();

  // Materiality denominator: only the *material* metrics' weights
  // contribute to the share-of-total. Non-material rows are still
  // shown (the user might want to flip them back on), but their
  // slider is disabled and they don't dilute the share computation.
  const totalWeight = SCORED_METRICS.reduce((sum, m) => {
    if (metricsById[m.id]?.isMaterial === false) return sum;
    return sum + (weights[m.id] ?? 0);
  }, 0);
  const materialCount = SCORED_METRICS.filter(
    (m) => metricsById[m.id]?.isMaterial !== false,
  ).length;
  const maxTotal = materialCount * MAX_WEIGHT;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Strategy — ESG Materiality Weights</h1>
        <p style={styles.helper}>
          Choose how much each ESG metric matters in your overall score.
          All weights start at the midpoint, so every metric counts equally;
          move a slider up to mark a metric as more material for your
          organisation, or down to mark it as less material. Shares are
          normalised to total 100%. Topics flagged <em>not material</em> in
          their own editor are shown greyed out — they don&apos;t
          contribute to the share until you re-enable them.
        </p>
      </header>

      {SCORED_AREAS.map((area) => (
        <fieldset key={area} style={styles.fieldset}>
          <legend style={styles.legend}>{area}</legend>
          {SCORED_METRICS.filter((m) => m.area === area).map((m) => {
            const isMaterial = metricsById[m.id]?.isMaterial !== false;
            const w = weights[m.id] ?? MAX_WEIGHT;
            const share =
              !isMaterial || totalWeight === 0
                ? 0
                : (w / totalWeight) * 100;
            return (
              <div
                key={m.id}
                style={isMaterial ? styles.row : styles.rowDisabled}
              >
                <span style={styles.rowLabel}>
                  {m.title}
                  {!isMaterial && (
                    <span style={styles.notMaterialTag}>
                      {" "}
                      — not material
                    </span>
                  )}
                </span>
                <input
                  type="range"
                  className="win2k-slider"
                  min={0}
                  max={MAX_WEIGHT}
                  step={1}
                  value={w}
                  disabled={!isMaterial}
                  onChange={(e) =>
                    dispatch(
                      setWeight({
                        id: m.id,
                        weight: Number(e.target.value),
                      }),
                    )
                  }
                  aria-label={`${m.title} weight`}
                />
                <span style={styles.weight}>
                  {w} / {MAX_WEIGHT}
                </span>
                <span style={styles.share}>
                  {isMaterial ? `${share.toFixed(1)}%` : "—"}
                </span>
              </div>
            );
          })}
        </fieldset>
      ))}

      <div style={styles.footer}>
        <button
          type="button"
          {...reset.handlers}
          onClick={() => dispatch(resetWeights())}
          style={{
            ...styles.resetButton,
            ...(reset.state.hover ? styles.resetButtonHover : null),
            ...(reset.state.focused ? styles.resetButtonFocus : null),
            ...(reset.state.pressed ? styles.resetButtonPressed : null),
          }}
        >
          Reset to defaults
        </button>
        <span style={styles.totals}>
          Total raw weight: {totalWeight} / {maxTotal}
        </span>
      </div>
    </div>
  );
}
