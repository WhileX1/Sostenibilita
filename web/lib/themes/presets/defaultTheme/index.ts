import { bottombar } from "./components/layout/bottombar";
import { startButton } from "./components/layout/startButton";
import { startMenu } from "./components/layout/startMenu";
import { desktop } from "./components/layout/desktop";
import { desktopIcon } from "./components/layout/desktopIcon";
import { window } from "./components/layout/window";
import { taskbarButton } from "./components/layout/taskbarButton";
import { clock } from "./components/layout/clock";
import { strategy as objectiveStrategy } from "./components/pages/objective/strategy";

export const defaultTheme = {
  bottombar,
  startButton,
  startMenu,
  desktop,
  desktopIcon,
  window,
  taskbarButton,
  clock,
  // Page-level slices live under `pages.<area>.<page>` so they don't
  // collide with the flat chrome keys above. Add a new entry here whenever
  // a page grows enough Win2K-specific styling to need its own slice.
  pages: {
    objective: {
      strategy: objectiveStrategy,
    },
  },
} as const;

export type Theme = typeof defaultTheme;
