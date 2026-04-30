"use client";

import { createContext, useState, type ReactNode } from "react";
import { themes, type ThemeName, type Theme } from "./themes";

export interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialTheme = "default",
  children,
}: {
  initialTheme?: ThemeName;
  children: ReactNode;
}) {
  const [themeName, setThemeName] = useState<ThemeName>(initialTheme);
  return (
    <ThemeContext.Provider
      value={{ theme: themes[themeName], themeName, setThemeName }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
