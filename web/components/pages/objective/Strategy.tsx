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
  const dispatch = useAppDispatch();
  const reset = useButtonState();

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const maxTotal = SCORED_METRICS.length * MAX_WEIGHT;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Strategy — ESG Materiality Weights</h1>
        <p style={styles.helper}>
          Choose how much each ESG metric matters in your overall score.
          All weights start at the midpoint, so every metric counts equally;
          move a slider up to mark a metric as more material for your
          organisation, or down to mark it as less material. Shares are
          normalised to total 100%.
        </p>
      </header>

      {SCORED_AREAS.map((area) => (
        <fieldset key={area} style={styles.fieldset}>
          <legend style={styles.legend}>{area}</legend>
          {SCORED_METRICS.filter((m) => m.area === area).map((m) => {
            const w = weights[m.id] ?? MAX_WEIGHT;
            const share = totalWeight === 0 ? 0 : (w / totalWeight) * 100;
            return (
              <div key={m.id} style={styles.row}>
                <span style={styles.rowLabel}>{m.title}</span>
                <input
                  type="range"
                  className="win2k-slider"
                  min={0}
                  max={MAX_WEIGHT}
                  step={1}
                  value={w}
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
                <span style={styles.share}>{share.toFixed(1)}%</span>
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
