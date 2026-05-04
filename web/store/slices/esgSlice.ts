import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { MAX_WEIGHT, SCORED_METRICS } from "@/lib/scoring/config";

interface EsgState {
  // Materiality weight per metric, integer in [0, MAX_WEIGHT]. Default is
  // the midpoint for every metric — neutral start where everything counts
  // equally and the user can move sliders either up or down to express
  // materiality.
  weights: Record<string, number>;
}

const DEFAULT_WEIGHT = Math.round(MAX_WEIGHT / 2);

function defaultWeights(): Record<string, number> {
  return Object.fromEntries(SCORED_METRICS.map((m) => [m.id, DEFAULT_WEIGHT]));
}

const initialState: EsgState = {
  weights: defaultWeights(),
};

const slice = createSlice({
  name: "esg",
  initialState,
  reducers: {
    setWeight: (
      state,
      action: PayloadAction<{ id: string; weight: number }>,
    ) => {
      const { id, weight } = action.payload;
      if (!(id in state.weights)) return;
      state.weights[id] = Math.max(0, Math.min(MAX_WEIGHT, Math.round(weight)));
    },

    resetWeights: (state) => {
      state.weights = defaultWeights();
    },
  },
});

export const { setWeight, resetWeights } = slice.actions;
export default slice.reducer;
