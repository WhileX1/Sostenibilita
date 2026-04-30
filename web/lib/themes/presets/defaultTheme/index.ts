import { topbar } from "./components/layout/topbar";
import { bottombar } from "./components/layout/bottombar";
import { startButton } from "./components/layout/startButton";
import { startMenu } from "./components/layout/startMenu";
import { desktop } from "./components/layout/desktop";
import { desktopIcon } from "./components/layout/desktopIcon";
import { window } from "./components/layout/window";
import { taskbarButton } from "./components/layout/taskbarButton";
import { clock } from "./components/layout/clock";

export const defaultTheme = {
  topbar,
  bottombar,
  startButton,
  startMenu,
  desktop,
  desktopIcon,
  window,
  taskbarButton,
  clock,
} as const;

export type Theme = typeof defaultTheme;
