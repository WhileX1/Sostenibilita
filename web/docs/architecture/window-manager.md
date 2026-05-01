# Window manager

The app shell is a Win2K-style desktop with a single-foreground window model: one window at a time is rendered, centered over the wallpaper at 80% of the desktop area. Every other "open" id is still tracked — its taskbar button is visible — but it is not in the DOM until it gets brought to the foreground.

## Pieces

| Layer            | Role                                                                                | Lives in                                                                  |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Redux slice      | Source of truth: which windows are open, which one is active                        | [`web/store/slices/windowsSlice.ts`](../../store/slices/windowsSlice.ts)  |
| Registry         | Static map of `id → { title, route, area, lazy Component }` + icon path helper     | [`web/lib/windows/registry.ts`](../../lib/windows/registry.ts)            |
| Mount hook       | Tiny client hook each route's `page.tsx` calls to translate URL → state             | [`web/lib/windows/useOpenWindowOnMount.ts`](../../lib/windows/useOpenWindowOnMount.ts) |
| Window content   | The actual page UI, lazy-loaded via `next/dynamic`                                  | [`web/components/pages/<area>/<Name>.tsx`](../../components/pages/)       |
| Window frame     | Title bar (with close button) + body. No drag, no resize, no min/max.               | [`web/components/layout/Window.tsx`](../../components/layout/Window.tsx)  |

## State shape

```ts
interface WindowsState {
  // Insertion order — drives the taskbar. Append on `openWindow` of a new
  // id, splice on `closeWindow`. Never mutated by focus changes, so a
  // taskbar button keeps its slot as the user shuffles between windows.
  order: string[];
  // The window currently shown in the centered foreground slot. `null`
  // means no window is rendered — every id in `order` is still "open" and
  // has a taskbar button, but the desktop is bare.
  activeId: string | null;
  // Sparse map: ids whose user-set state is "fill the desktop" (vs. the
  // default centered 80%). Per-id (not a single flag) so a window
  // remembers its own size when the user shuffles between them.
  maximized: Record<string, true>;
}
```

There is no other per-window state: no geometry (always centered, either 80% or full), no z-stack (only one window at a time). "Background" windows are exactly the ones in `order` that aren't `activeId` — they cost nothing in the DOM and reappear instantly when the user clicks their taskbar button.

## Reducer actions

| Action                  | Effect                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `openWindow(id)`        | Append `id` to `order` if new, set `activeId = id`. Idempotent for already-open ids.                    |
| `closeWindow(id)`       | Remove from `order`, drop any `maximized` entry. If was active, transfer focus to the last entry in `order` (or null). |
| `focusWindow(id)`       | Set `activeId = id` (no-op if `id` isn't in `order`).                                                   |
| `deactivateWindow()`    | Set `activeId = null` — every window stays open, no foreground is rendered.                             |
| `toggleMaximize(id)`    | Flip the `maximized[id]` flag. Doesn't change `activeId` or `order`.                                    |

## Interactions

### Open
A desktop icon double-click, a Start menu item click, or a deep-link mount all call `openWindow(id)`. The id appends to `order` (if new) and becomes `activeId`. Re-opening an already-open id just sets `activeId`.

### Switch foreground
Clicking an inactive taskbar button dispatches `focusWindow(id)` and `router.replace(def.route)`. The previously-active window unmounts; its lazy chunk stays cached so reopening is instant.

### Hide foreground
Two paths produce the same result — `activeId = null`, every open id stays on the taskbar, no window renders:

- Clicking the active taskbar button dispatches `deactivateWindow()`.
- Clicking the **minimize** glyph in the title bar dispatches `deactivateWindow()`.

### Maximize / restore
The **maximize** glyph in the title bar dispatches `toggleMaximize(id)`. When `maximized[id]` is set, the window root applies `theme.window.rootMaximized` (`inset: 0`), filling the desktop edge-to-edge over the wallpaper but **not** the topbar / bottombar — the window is a child of `Desktop`, so its 0-inset stops at the desktop's bounds. The glyph swaps to the "restore" cascade-of-squares; clicking again removes the flag and the window returns to centered 80%.

The flag is per-id: switching foreground to a different window and back preserves whether the user had it maximized.

### Close
The X button in the title bar dispatches `closeWindow(id)`. If the URL still points at that window's route, `router.replace("/")` follows.

There is no drag, no resize. The window's size is determined by CSS — `inset: 10%` (centered 80%) by default, `inset: 0` when maximized. Browser zoom scales the window proportionally with the desktop because the size is expressed in percentages, not pixels.

## Routing — URL ↔ state

The flow is **URL → state**, not the other way around. The URL reflects "the most recently launched window from a navigation event"; closing or hiding a window doesn't always rewrite it.

- **Deep-link** (`/environmental/co2-emissions`): the route's `page.tsx` is a thin Client Component that calls `useOpenWindowOnMount("environmental/co2-emissions")` and returns `null`.
- **Desktop icon double-click**: `openWindow(id)` + `router.push(route)`.
- **Start menu item click**: same as desktop icon click + close menu.
- **Taskbar button click on active**: `deactivateWindow()` (no URL change — the route still maps to the window the user just hid).
- **Taskbar button click on inactive**: `focusWindow(id)` + `router.replace(route)`.
- **Minimize button**: `deactivateWindow()` (no URL change).
- **Maximize / Restore button**: `toggleMaximize(id)` (no URL change).
- **Close button**: `closeWindow(id)`. If the URL still points at that window's route, also `router.replace("/")`.

## The registry contract

[`registry.ts`](../../lib/windows/registry.ts) maps a stable string id (always `route.slice(1)`) onto:

- `title` — text for the title bar / taskbar button / start-menu label.
- `route` — Next.js path. Used by `<Link>` / `router.push` for deep-link sync.
- `area` — `"Environmental" | "Social" | "Governance" | "Objective"`. Used to group items in the Start menu submenus.
- `scored?` — when `true`, this window is a measurable ESG metric and feeds the score (see [`scoring.md`](scoring.md)). The 10 E/S/G windows have it; the 3 Objective windows don't.
- `Component` — the lazy-loaded page UI, declared as `dynamic(() => import("@/components/pages/..."))`.

The icon for each window is resolved by the `iconPath(def)` helper, which returns `/icons/${id}.svg`. The SVG file lives in `web/public/icons/<area>/<slug>.svg`.

Area-level icons (the four ESG groupings) are resolved by `areaIconPath(area)` and live at `web/public/icons/areas/<area>.svg`. Used by the Start menu's top-level rows so an area is visually distinguished from any of its child windows.

Adding a new window is a 4-step recipe:

1. Add a new entry to `WINDOW_REGISTRY` with a fresh id matching its route.
2. Create the matching `web/components/pages/<area>/<Name>.tsx`.
3. Create `web/app/<area>/<route>/page.tsx` calling `useOpenWindowOnMount("<id>")`.
4. Drop a `<id>.svg` into `web/public/icons/<area>/`.

No other file needs to change — the desktop icon grid, start menu, and taskbar all enumerate from the registry.

## Why `next/dynamic`?

Without lazy loading, all 13 page components are bundled with the desktop and live in memory whether or not the user has opened any of them. With `next/dynamic`, each `import()` is a separate chunk; the chunk is fetched on the first `openWindow` for that id. With the single-foreground model, switching between two open windows unmounts the previous content — but the lazy chunk is cached by the bundler, so re-mounting is instantaneous after the first time. The `Window.tsx` body wraps `<Content />` in `<Suspense>` so the lazy fetch shows a "Loading…" placeholder rather than blocking render.

In the App Router, `dynamic()` does **not** server-render by default, which is exactly what we want — the desktop's initial state is empty, so SSR has nothing useful to do for window content.

## What this design does not do

- **No window state persistence** across reloads — refreshing closes everything except the deep-linked window. Adding `redux-persist` (or a small `localStorage` middleware) is a future option.
- **No multi-instance per id** — opening "CO₂ Emissions" twice focuses the existing window instead of creating a second one. This matches the "one document, one window" model that fits ESG dashboard pages.
- **No simultaneous windows** — by design, only one is on screen at a time. The taskbar still shows every open window (each a single click away). If a future page actually needs two-window comparison, the slice can grow back per-window state without changing the registry contract.
- **No keyboard window navigation** (Alt+Tab, Alt+Space, etc.) — only mouse-driven interactions are wired up. The taskbar buttons are tab-focusable so keyboard-only users can still navigate between open windows; window contents themselves remain fully tab-navigable inside.
