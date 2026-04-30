import { defaultTheme } from "./presets/defaultTheme";

export const themes = {
  default: defaultTheme,
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = (typeof themes)[ThemeName];
