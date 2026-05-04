import { bottombar } from "./components/layout/bottombar";
import { startButton } from "./components/layout/startButton";
import { startMenu } from "./components/layout/startMenu";
import { desktop } from "./components/layout/desktop";
import { desktopIcon } from "./components/layout/desktopIcon";
import { window } from "./components/layout/window";
import { taskbarButton } from "./components/layout/taskbarButton";
import { clock } from "./components/layout/clock";
import { strategy as objectiveStrategy } from "./components/pages/objective/strategy";
import { ratingEsg as objectiveRatingEsg } from "./components/pages/objective/ratingEsg";
import { reportingCsrd as objectiveReportingCsrd } from "./components/pages/objective/reportingCsrd";
import { metricEditor } from "./components/pages/metricEditor";

export const defaultTheme = {
  bottombar,
  startButton,
  startMenu,
  desktop,
  desktopIcon,
  window,
  taskbarButton,
  clock,
  // Page-level slices live under `pages.<area>.<page>` (per-page chrome) or
  // `pages.<shared>` (chrome shared across pages, like `metricEditor` —
  // every scored E/S/G page renders the same editor shell). Add a new
  // entry here whenever a page grows enough Win2K-specific styling to
  // need its own slice.
  pages: {
    metricEditor,
    objective: {
      strategy: objectiveStrategy,
      ratingEsg: objectiveRatingEsg,
      reportingCsrd: objectiveReportingCsrd,
    },
  },
} as const;

export type Theme = typeof defaultTheme;
