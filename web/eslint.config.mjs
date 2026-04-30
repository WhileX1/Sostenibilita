import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // We render small static SVG icons (16-32px) as <img> in chrome
    // components — Desktop icons, taskbar buttons, start menu, start logo.
    // next/image's optimization pipeline adds no value for already-vector
    // tiny assets, and using it for SVGs requires `dangerouslyAllowSVG`.
    // Disable the warning project-wide to keep the inline-style chrome code
    // free of disable comments.
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
