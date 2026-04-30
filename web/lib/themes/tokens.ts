export const COLORS = {
  // Neutrals
  black:   "#000000",
  white:   "#FFFFFF",
  gray200: "#DFDFDF",
  gray500: "#808080",
  gray700: "#404040",

  // Warm gray (control / window face)
  beige:   "#D4D0C8",

  // Blues
  blue100: "#A6CAF0",
  blue900: "#0A246A",
} as const;

export const FONTS = {
  sans: "var(--font-geist-sans)",
} as const;

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
