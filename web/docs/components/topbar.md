# Topbar

App-shell header rendered as the first row of the desktop chrome, above the [`Desktop`](desktop.md) and the [`Bottombar`](bottombar.md).

- Component: [`web/components/layout/Topbar.tsx`](../../components/layout/Topbar.tsx)
- Theme slice: [`web/lib/themes/presets/defaultTheme/components/layout/topbar.ts`](../../lib/themes/presets/defaultTheme/components/layout/topbar.ts) → exposed as `theme.topbar`
- Mounted in: [`web/app/layout.tsx`](../../app/layout.tsx) (root layout, inside `<ThemeProvider>`)

## Current shape

A 28px `<header>` strip with the brand label "Sostenibilità" on the left, painted on the same blue gradient as active window title bars (Win2K-cohesive). The root style uses `justify-content: space-between`, so future right-aligned content (user menu, search, etc.) drops in without restructuring.

```
┌──────────────────────────────────────────────────────────┐
│ Sostenibilità                                            │   ← topbar (28px, blue gradient)
├──────────────────────────────────────────────────────────┤
│ Desktop (wallpaper + icons + windows)                    │
├──────────────────────────────────────────────────────────┤
│ Bottombar (Start | task buttons | clock)                 │
└──────────────────────────────────────────────────────────┘
```

## Theme keys consumed

| Key     | Applied to                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------ |
| `root`  | `<header>` — 28px tall, `SURFACE_SECONDARY` blue gradient, dark border-bottom, flex row, `userSelect: none` |
| `brand` | the brand `<span>` — typography (Tahoma, 13px, bold, white)                                      |

## Extending

- **Right-side actions** (avatar, notifications, search): add elements as siblings of `<span style={theme.topbar.brand}>` — the existing `space-between` already pushes them to the right.
- **New theme keys**: add them to [`topbar.ts`](../../lib/themes/presets/defaultTheme/components/layout/topbar.ts) (e.g. `actionButton`, `divider`). They'll be reachable as `theme.topbar.<key>` automatically — no change to the assembler ([`defaultTheme/index.ts`](../../lib/themes/presets/defaultTheme/index.ts)) is needed.
- **Tokens**: visual values are sourced from [`defaultTheme/constants.ts`](../../lib/themes/presets/defaultTheme/constants.ts) (`SURFACE_SECONDARY`, `BORDER_SECONDARY`, `TEXT_ON_SECONDARY`). Reuse those instead of hardcoding hex.

## Notes

- Client Component (`"use client"`) because it consumes `useTheme` (a React Context hook).
- The component is purely presentational at the moment; no state, no props.
- `userSelect: none` on the root prevents the brand label from being highlighted by an accidental drag from the desktop area below.
