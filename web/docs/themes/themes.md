# Theme System

Centralized styling for the app. All component styles live as data in `web/lib/themes`, never as hex literals or Tailwind classes inside components. Components consume styles via `useTheme()` and spread them into `style={...}`.

## File structure

```
web/lib/themes/
  tokens.ts                              ← Layer 0 — primitives shared across all presets
  themes.ts                              ← Layer 3 — preset map { default, ... }
  themeProvider.tsx                      ← Layer 4 — React Context provider
  useTheme.ts                            ← Layer 4 — hook
  index.ts                               ← Layer 5 — public API (consumers import from here)
  presets/
    defaultTheme/                        ← Layer 2 — the active preset
      constants.ts                       ← preset palette aliases (private to the preset)
      index.ts                           ← assembler: composes the preset object + exports `Theme`
      components/                        ← mirror of web/components/ — one *.ts per component
        layout/
          bottombar.ts                   ← exposed as theme.bottombar
          startButton.ts                 ← exposed as theme.startButton
          startMenu.ts                   ← exposed as theme.startMenu
          desktop.ts                     ← exposed as theme.desktop
          desktopIcon.ts                 ← exposed as theme.desktopIcon
          window.ts                      ← exposed as theme.window
          taskbarButton.ts               ← exposed as theme.taskbarButton
          clock.ts                       ← exposed as theme.clock
        pages/                           ← mirror of web/components/pages/ — page-level slices
          objective/
            strategy.ts                  ← exposed as theme.pages.objective.strategy
```

## Dependency chain (no cycles)

```
tokens.ts
  ↓
presets/defaultTheme/constants.ts
  ↓
presets/defaultTheme/components/**/*.ts        (and (app)/**/page.ts when present)
  ↓
presets/defaultTheme/index.ts                  ← assembler of the preset
  ↓
themes.ts                                      ← preset map + ThemeName + Theme
  ↓
themeProvider.tsx ← useTheme.ts
  ↓
index.ts                                       ← public API
```

Rules enforced by the structure:

- `tokens.ts` imports nothing.
- Files inside `defaultTheme/` import primitives from `../../tokens` and aliases from `./constants` (or `../../constants` for component slices).
- Component slices (`components/<area>/<name>.ts`) **never** import directly from `tokens.ts` — they go through `constants.ts`. This keeps the preset's semantic layer the single point of remapping.
- `themeProvider.tsx` imports from `./themes`, **not** directly from a preset. This decoupling is the whole reason `themes.ts` exists.
- Consumers (`Window.tsx`, `StartButton.tsx`, `app/layout.tsx`, …) import from `@/lib/themes` only.

## Layer 0 — `tokens.ts`

Cross-preset primitives. Every preset can reference these.

| Export       | Contents                                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COLORS`     | hex palette — neutrals (`black`, `white`, `gray200/500/700`), warm gray (`beige`), blues (`blue100/900`)                                                                                                                                       |
| `FONTS`      | `sans` CSS variable (Geist)                                                                                                                                                                                                                    |
| `hexToRgba`  | utility to compose alpha overlays from hex                                                                                                                                                                                                     |

`tokens.ts` is the **single source of hex literals** in the theme system. Every color used downstream — bevel shades, surface backgrounds, text overlays — must trace back to an entry in `COLORS`. Constant slices (`constants.ts`) only remap; they never declare new hex values. New presets extend the palette here rather than inlining colors locally. Names are hue-and-scale based (`blue900`, `gray500`, …) so primitives stay reusable across presets without theme attribution leaking in.

## Layer 2 — `presets/defaultTheme/`

### `constants.ts` — semantic aliases (preset-private)

Imports from `tokens.ts` and exposes the names the rest of the preset uses:

| Group           | Aliases                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Surfaces        | `SURFACE_PRIMARY`, `SURFACE_SECONDARY`, `SURFACE_WINDOW`, `BORDER_SECONDARY`                           |
| Text            | `TEXT_ON_PRIMARY`, `TEXT_ON_SECONDARY`, `TEXT_ON_PRIMARY_STRONG`, `TEXT_ON_PRIMARY_MUTED`              |
| Accent          | `ACCENT_PRIMARY`, `TEXT_ON_ACCENT_PRIMARY`                                                             |
| Bevel           | `BEVEL_LIGHT`, `BEVEL_HILITE`, `BEVEL_SHADOW`, `BEVEL_DARK`                                            |
| Title bar       | `TITLE_BAR_ACTIVE`, `TEXT_ON_TITLE_BAR_ACTIVE`, `TITLE_BAR_INACTIVE`, `TEXT_ON_TITLE_BAR_INACTIVE`     |
| Start menu      | `START_MENU_BANNER`, `TEXT_ON_START_MENU_BANNER`                                                       |
| Typography      | `FONT_SANS`                                                                                            |

Aliases use a `PRIMARY` / `SECONDARY` tier scheme — brightness-agnostic by design. `PRIMARY` is the dominant chrome surface (the bottombar, window frames, buttons), `SECONDARY` is the accent gradient (currently the active window title bar and the Start menu's vertical banner). `ON_<tier>` qualifies content that sits on a given surface; `_STRONG` / `_MUTED` are emphasis variants. A future preset may invert which tier is dark or light without renaming.

These are the only names component slices are expected to use. Changing what they map to in `constants.ts` propagates everywhere downstream — that's the whole point.

### `components/<area>/<name>.ts` — one file per component

Mirror of `web/components/`. A file here = a component reachable through `theme.<name>`:

| File                                       | Exposed as            | Component                                                            |
| ------------------------------------------ | --------------------- | -------------------------------------------------------------------- |
| `components/layout/bottombar.ts`           | `theme.bottombar`     | [`Bottombar.tsx`](../../components/layout/Bottombar.tsx)             |
| `components/layout/startButton.ts`         | `theme.startButton`   | [`StartButton.tsx`](../../components/layout/StartButton.tsx)         |
| `components/layout/startMenu.ts`           | `theme.startMenu`     | [`StartMenu.tsx`](../../components/layout/StartMenu.tsx)             |
| `components/layout/desktop.ts`             | `theme.desktop`       | [`Desktop.tsx`](../../components/layout/Desktop.tsx)                 |
| `components/layout/desktopIcon.ts`         | `theme.desktopIcon`   | [`DesktopIcon.tsx`](../../components/layout/DesktopIcon.tsx)         |
| `components/layout/window.ts`              | `theme.window`        | [`Window.tsx`](../../components/layout/Window.tsx)                   |
| `components/layout/taskbarButton.ts`       | `theme.taskbarButton` | [`TaskbarButton.tsx`](../../components/layout/TaskbarButton.tsx)     |
| `components/layout/clock.ts`               | `theme.clock`         | [`Clock.tsx`](../../components/layout/Clock.tsx)                     |

Each slice exports a single `as const` object whose keys are merged-spread into `style={...}` by the component.

### `components/pages/<area>/<page>.ts` — page-level styles

Mirror of `web/components/pages/`. A file is created when a page grows enough Win2K-specific styling (multiple controls, custom layout) to be worth extracting. Exposed under `theme.pages.<area>.<page>` so the flat chrome keys above stay flat.

| File                                                       | Exposed as                          | Component                                                                          |
| ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `components/pages/objective/strategy.ts`                   | `theme.pages.objective.strategy`    | [`Strategy.tsx`](../../components/pages/objective/Strategy.tsx)                    |

The other 12 pages don't have a slice yet — they're still placeholders. As each gets a real form / dashboard, add a sibling file under `components/pages/<area>/`.

## CSS escape hatch — `web/app/globals.css`

The theme system uses inline styles, which can't reach native pseudo-elements: `::-webkit-slider-thumb`, `::-moz-range-thumb`, `::-webkit-scrollbar*`, `:hover`/`:focus-visible`/`:active` on form controls in some cases. Anything that *requires* a CSS pseudo-element to style lives in [`globals.css`](../../app/globals.css).

Currently this means: the Win2K range slider (`.win2k-slider`) used in `Strategy.tsx`. To avoid hex-literal drift, the palette is mirrored into [`globals.css`](../../app/globals.css) as CSS custom properties on `:root` (`--color-*`, `--bevel-*`, `--surface-*`) and the slider rules reference `var(...)` only. Keep the `:root` block in sync with [`tokens.ts`](../../lib/themes/tokens.ts) and [`constants.ts`](../../lib/themes/presets/defaultTheme/constants.ts); the rest of the codebase reads colors via the JS theme system, never via these vars.

### `index.ts` — assembler

Pure import-and-spread. Order in the export object doesn't matter at runtime, but the existing convention groups by surface (chrome bars first, then desktop, then windows, then atoms):

```ts
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
  bottombar, startButton, startMenu,
  desktop, desktopIcon, window, taskbarButton, clock,
  pages: {
    objective: { strategy: objectiveStrategy },
  },
} as const;
export type Theme = typeof defaultTheme;
```

`Theme` is the canonical shape. Future presets must `satisfies Theme` to stay assignable.

## Layer 3 — `themes.ts`

```ts
import { defaultTheme } from "./presets/defaultTheme";

export const themes = {
  default: defaultTheme,
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = (typeof themes)[ThemeName];
```

Exists to keep `themeProvider.tsx` decoupled from concrete presets. When a second preset arrives, it's a one-line edit here.

## Layer 4 — `themeProvider.tsx` + `useTheme.ts`

Wrap the app once at the root (`web/app/layout.tsx`):

```tsx
<ThemeProvider initialTheme="default">
  <App />
</ThemeProvider>
```

Read the theme anywhere in client components:

```tsx
const { theme, themeName, setThemeName } = useTheme();
```

`useTheme` throws if called outside the provider — this is intentional, fail-fast on a wiring bug.

## Layer 5 — `index.ts`

The single entry point consumers import from:

```ts
import { useTheme, ThemeProvider, themes, type ThemeName, type Theme } from "@/lib/themes";
```

Importing from internal paths (`@/lib/themes/themeProvider`, `@/lib/themes/presets/...`) is discouraged — those are implementation details that may move.

## How to…

### Add a new component slice

1. Create `web/lib/themes/presets/defaultTheme/components/<area>/<name>.ts` mirroring the path of the React component under `web/components/<area>/<Name>.tsx`.
2. Export a single `as const` object (`export const <name> = { ... } as const;`). Pull colors/fonts from `../../constants` only.
3. Re-export it in `defaultTheme/index.ts`:
   ```ts
   import { foo } from "./components/<area>/<name>";
   export const defaultTheme = { bottombar, window, foo } as const;
   ```
4. Consume in the React component via `theme.foo.<key>`.

### Add a page-level slice

Same pattern as components, under `(app)/<route>/page.ts`. Only do this if the page has keys that don't belong to any component.

### Add a token / alias

- A new color shared across all presets → add to `COLORS` in `tokens.ts`.
- A semantic name used inside `defaultTheme` → add to `defaultTheme/constants.ts`.
- The general rule: introduce things at the most local level that fits, then promote upward when a second consumer appears.

### Add a new preset

1. Create `presets/myTheme/` with the same internal structure as `defaultTheme/` (at minimum: `constants.ts`, `index.ts`, and the component slices it overrides).
2. Its `index.ts` should `export const myTheme = { ... } satisfies Theme;` (importing `Theme` from `@/lib/themes`) so TypeScript enforces shape-compatibility with `defaultTheme`.
3. Register it in `themes.ts`:
   ```ts
   export const themes = {
     default: defaultTheme,
     my:      myTheme,
   } as const;
   ```
   `ThemeName` and `Theme` update by inference; no other change needed.

## Conventions

- **Inline styles, not Tailwind classes**, for theme-driven visuals. Tailwind classes are fine for layout primitives (`flex`, `min-h-screen`, …) in `app/layout.tsx`, but never for colors or component visuals.
- **Spread to compose state**: `style={{ ...theme.x.base, ...(active ? theme.x.active : null) }}`. Each slice should expose a small base + a few merge-able overlays rather than one big function.
- **Object literals are typed `as CSSProperties`** at the leaf level so React's prop types stay happy with the const-narrowed object.
- **Public API is `@/lib/themes`** — anything else is internal.
