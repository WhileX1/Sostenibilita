# Window manager

The app shell is a Win2K-style desktop: each ESG page opens as a movable, resizable, minimizable window over a wallpaper, the bottombar shows one task button per open window, and the URL still works as a deep-link. This page documents how the pieces fit together.

## Pieces

| Layer            | Role                                                                                | Lives in                                                                  |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Redux slice      | Source of truth: which windows are open, geometry, z-order, active id, min/max flags | [`web/store/slices/windowsSlice.ts`](../../store/slices/windowsSlice.ts)  |
| Registry         | Static map of `id → { title, route, area, lazy Component }` + icon path helper     | [`web/lib/windows/registry.ts`](../../lib/windows/registry.ts)            |
| Mount hook       | Tiny client hook each route's `page.tsx` calls to translate URL → state             | [`web/lib/windows/useOpenWindowOnMount.ts`](../../lib/windows/useOpenWindowOnMount.ts) |
| Window content   | The actual page UI, lazy-loaded via `next/dynamic`                                  | [`web/components/pages/<area>/<Name>.tsx`](../../components/pages/)       |
| Window frame     | Title bar (drag) + min/max/close buttons + body + 8 resize handles                  | [`web/components/layout/Window.tsx`](../../components/layout/Window.tsx)  |

## State shape

```ts
interface WindowsState {
  byId:             Record<string, WindowInstance>;
  // **Insertion order** — drives the taskbar. Append on open, splice on
  // close. *Never* mutated on focus, so taskbar buttons stay put as the
  // user shuffles windows.
  order:            string[];
  activeId:         string | null;
  nextZIndex:       number;     // monotonically increasing — assigned to a window's `zIndex` on focus
  nextCascadeIndex: number;     // monotonically increasing — drives cascade positioning
}

interface WindowInstance {
  id: string;
  x: number; y: number; width: number; height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  // Saved geometry to restore to on un-maximize. While `isMaximized` is true,
  // the renderer ignores x/y/width/height and uses the desktop's bounds; we
  // never overwrite them so the user gets back exactly what they had.
  restoreBounds: { x; y; width; height } | null;
  // Painting order. Higher = closer to the user. Updated by `bumpZ` on
  // every focus change; never decreases.
  zIndex: number;
}
```

Two distinct orderings:

- **`order` (insertion)** — append on `openWindow` (new id), splice on `closeWindow`. Never mutated by focus changes. Drives the taskbar's left-to-right layout, so a button keeps its position as the user switches between windows.
- **`zIndex` (per-window)** — bumped to `state.nextZIndex++` on every focus event (`openWindow` of an existing id, `focusWindow`, `restoreWindow`, `toggleMaximize`). Drives CSS stacking. `topmostNonMinimized()` picks the next active window by scanning `byId` for the highest non-minimized `zIndex`.

Two arrays would have worked too; one array + one per-window field reads cleanly because the field is local to the window it describes.

## Reducer actions

| Action                      | Effect                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `openWindow(id)`            | If new: cascade-position + assign zIndex + push to `order` + activate. If existing: un-minimize, bumpZ. |
| `closeWindow(id)`           | Remove from `byId` + `order`. If was active, transfer focus to the topmost non-minimized.    |
| `focusWindow(id)`           | Bump `zIndex`, mark active. **Does not touch `order`** — taskbar position stays put.         |
| `minimizeWindow(id)`        | Set `isMinimized = true`. If was active, transfer focus to the topmost non-minimized.        |
| `restoreWindow(id)`         | Set `isMinimized = false`, bumpZ.                                                            |
| `toggleMaximize(id)`        | Snapshot current bounds → set `isMaximized` (or restore from snapshot). bumpZ.               |
| `setWindowBounds({id,...})` | Drag + resize commit point. No-op while `isMaximized` (consumer should restore first).       |

Minimized windows stay in `order` (so their taskbar button keeps its slot) and keep their `zIndex` (so on restore they pop back to the position they were at). The desktop skips rendering them; their taskbar button is still visible — clicking it dispatches `restoreWindow`.

## Interactions

### Drag
The title bar's `onMouseDown` registers document-level `mousemove` / `mouseup` listeners. The `mousemove` handler updates a **local** React state (not Redux) so we don't churn the store at 60fps; the inline style of the window root reads this local state for live preview. On `mouseup` the final position is dispatched as `setWindowBounds` once. Position is clamped so the window stays inside the desktop's content area.

Maximized windows ignore drag — clicking their title bar doesn't start one. Double-clicking the title bar toggles maximize.

### Resize
Eight invisible handles around the frame (4 edges as 4px-wide strips, 4 corners as 8×8 squares). Corners render after edges in DOM order so their cursor wins on overlap. Each handle's mousedown does the same local-state-then-dispatch dance as drag, but the geometry change is computed by `applyResize(dir, dx, dy, init)` — moving the opposite edge to enforce the 240×160 minimum size, then `clampToParent` to keep the box inside the desktop. While resizing, `document.body.style.cursor` is forced to the handle's cursor so it doesn't flicker if the mouse leaves the 4px strip.

### Minimize / Maximize / Close
Three icon buttons in the title bar's right cluster, in Win2K order **\[_\] \[□\] \[X\]**. Glyphs are inline SVG (no font dependency). Each tracks a local `pressed` state for the bevel-inversion press effect. Maximize swaps to the "restore" glyph (two overlapping squares) when the window is already maximized.

Maximize spans the **desktop area only** — not the topbar — so the app shell stays visible. The window root sets `inset: 0` in its container while maximized, which fills the desktop without measuring it in JS.

## Routing — URL ↔ state

The flow is **URL → state**, not the other way around. The URL reflects "the most recently launched window from a navigation event"; closing or focusing a different window doesn't always rewrite it.

- **Deep-link** (`/environmental/co2-emissions`): the route's `page.tsx` is a thin Client Component that calls `useOpenWindowOnMount("environmental/co2-emissions")` and returns `null`.
- **Desktop icon click**: `openWindow(id)` + `router.push(route)`.
- **Start menu item click**: same as desktop icon click + close menu.
- **Taskbar button click**: depends on state — `restoreWindow` if minimized, `minimizeWindow` if active visible (Win2K-style), `focusWindow` otherwise. Always `router.replace(route)`.
- **Close button**: `closeWindow(id)`. If the URL still points at that window's route, also `router.replace("/")`.

## The registry contract

[`registry.ts`](../../lib/windows/registry.ts) maps a stable string id (always `route.slice(1)`) onto:

- `title` — text for the title bar / taskbar button / start-menu label.
- `route` — Next.js path. Used by `<Link>` / `router.push` for deep-link sync.
- `area` — `"Environmental" | "Social" | "Governance" | "Objective"`. Used to group items in the Start menu submenus.
- `Component` — the lazy-loaded page UI, declared as `dynamic(() => import("@/components/pages/..."))`.

The icon for each window is resolved by the `iconPath(def)` helper, which returns `/icons/${id}.svg`. The SVG file lives in `web/public/icons/<area>/<slug>.svg`.

Adding a new window is a 4-step recipe:

1. Add a new entry to `WINDOW_REGISTRY` with a fresh id matching its route.
2. Create the matching `web/components/pages/<area>/<Name>.tsx`.
3. Create `web/app/<area>/<route>/page.tsx` calling `useOpenWindowOnMount("<id>")`.
4. Drop a `<id>.svg` into `web/public/icons/<area>/`.

No other file needs to change — the desktop icon grid, start menu, and taskbar all enumerate from the registry.

## Why `next/dynamic`?

Without lazy loading, all 13 page components are bundled with the desktop and live in memory whether or not the user has opened any of them. With `next/dynamic`, each `import()` is a separate chunk; the chunk is fetched on the first `openWindow` for that id and the module is unmounted after `closeWindow`. The `Window.tsx` body wraps `<Content />` in `<Suspense>` so the lazy fetch shows a "Loading…" placeholder rather than blocking render.

In the App Router, `dynamic()` does **not** server-render by default, which is exactly what we want — the desktop's initial state is empty, so SSR has nothing useful to do for window content.

## What this design does not do

- **No window state persistence** across reloads — refreshing closes everything except the deep-linked window. Adding `redux-persist` (or a small `localStorage` middleware) is a future option.
- **No multi-instance per id** — opening "CO₂ Emissions" twice focuses the existing window instead of creating a second one. This is intentional and matches the "one document, one window" model that fits ESG dashboard pages.
- **No keyboard window navigation** (Alt+Tab, Alt+Space, etc.) — only mouse-driven interactions are wired up. The taskbar buttons are tab-focusable so keyboard-only users can still navigate between open windows; window contents themselves remain fully tab-navigable inside.
