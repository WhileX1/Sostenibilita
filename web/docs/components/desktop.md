# Desktop

Wallpaper, icon grid, and the layer that hosts open windows. Fills the area above the bottombar in the root layout and owns the absolute-positioned coordinate system every `Window` lives in.

- Component: [`web/components/layout/Desktop.tsx`](../../components/layout/Desktop.tsx)
- Subcomponents: [`DesktopIcon.tsx`](../../components/layout/DesktopIcon.tsx), [`Window.tsx`](../../components/layout/Window.tsx)
- Theme slices: [`desktop.ts`](../../lib/themes/presets/defaultTheme/components/layout/desktop.ts), [`desktopIcon.ts`](../../lib/themes/presets/defaultTheme/components/layout/desktopIcon.ts), [`window.ts`](../../lib/themes/presets/defaultTheme/components/layout/window.ts)
- Mounted in: [`web/app/layout.tsx`](../../app/layout.tsx)

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ ┌──┐                                             ┌──┐   │
│ │EN│          ┌───────────────────────┐          │CD│   │
│ │CO│          │ Window (centered 80%) │          │ET│   │
│ │WA│          │                       │          │SC│   │
│ │WS│          │                       │          │RC│   │
│ │HR│          │                       │          │RT│   │
│ │IN│          │                       │          │ST│   │
│ └──┘          └───────────────────────┘          └──┘   │
├─────────────────────────────────────────────────────────┤
│ [Start] │ task buttons …                      │ [12:34] │
└─────────────────────────────────────────────────────────┘
```

The first half of the registry seeds against the left edge in a single column, the second half against the right edge. With 18 registered windows: **9 left + 9 right**. The middle 80% of the desktop stays clear so an open window doesn't sit on top of any icons. Side, column, and row are stored per-icon in Redux — see "Draggable icons" below.

## Click semantics

Win2K "classic" mode separates selection from launch:

- **Single click** → select the icon (replace selection set with `{id}`, or toggle if `Ctrl`/`Cmd` is held for additive selection).
- **Double click** → open the window: dispatch `openWindow(def.id)` + `router.push(def.route)`.
- **Click on empty desktop** → clear the selection.
- **Drag on empty desktop** → marquee (rubber-band) selection, replaces the selection with whichever icons intersect the rectangle on release.

Selection state is local to the `Desktop` component (`useState<Set<string>>`) — it doesn't need to survive route changes, so Redux would be overkill. Selected icons get `theme.desktopIcon.rootSelected` (a stronger blue tint than `rootHover`), `iconSelected` (a slight opacity dim so the tint reads through), and `labelSelected` (sticky blue background, mirrors `labelHover`).

The marquee rectangle is rendered as a `<div style={theme.desktop.marquee, ...inline geometry}>`. It paints at z=5 — above icons (no z-index) but below windows (z=10+), so an open window hides the rubber-band where it overlaps.

## Draggable icons

Each icon is absolutely positioned inside the desktop. Position state lives in the [`desktopIcons`](../../store/slices/desktopIconsSlice.ts) Redux slice. The slice's `initialState` seeds every registered window into a unique grid cell at module load, so the desktop never needs a "missing id" fallback path.

The desktop is a **snap-to-grid** surface (Win2K "Align to Grid" semantics) with **side-anchored** cells: each icon stores `{ side: "left" | "right", col, row }` instead of a pixel `(x, y)`. Column 0 hugs the chosen edge, columns grow inward. This keeps icons pinned to the screen edges as the desktop resizes — and, more importantly, keeps the left/right edge strips clear of the centered 80% window, so opening a window doesn't hide them behind the frame.

Grid geometry lives in the slice:

- `ICON_COL_WIDTH` = 100, `ICON_ROW_HEIGHT` = 100, `ICON_PADDING` = 12. The cell pitch (100) = icon button height (88) + ~12px gap. Button height itself is locked in `desktopIcon.root` (`height: 88px`, `box-sizing: border-box`) so 1-line and 2-line label titles take the same vertical space — without this lock, "CDA" rendered ~67px tall while "Consumers and End-Users" rendered ~83px and the visible gap between rows depended on which titles met where.
- `autoPosition(index, total)` splits the registry roughly half-and-half between the two sides, single column on each, top-down by registry order. With 18 entries → 9 left + 9 right.
- `snapToGrid(x, y, parentWidth)` snaps a dropped pixel position to the nearest cell on whichever side the icon ended up more in (the icon's center decides). Caps `col` at `maxColsPerSide − 1` (see "Resize / zoom reflow" below) so a drop near the middle of a narrow desktop can't land in a column that would visually overlap with the opposite side.
- `iconPixelOf(pos, parentWidth)` translates a stored cell back into absolute pixels — used by marquee intersection and the drag-start snapshot, both reading the *resolved* cell (post-reflow), not the stored cell, so a zoom-induced reflow doesn't make the icon snap to a different position the moment the user starts dragging it. The renderer itself does **not** call `iconPixelOf`; instead it uses `iconStyleOf(pos)` (defined in `Desktop.tsx`) which returns edge-anchored CSS (`{ left, top }` or `{ right, top }`), so right-side icons paint at the correct position without depending on `parentWidth`.

### Drag is owned by `Desktop`, not `DesktopIcon`

The Win2K-style "drag the whole selection at once" gesture means a single drag may move N icons. Coordinating that requires shared state, so all gesture logic lives in the `Desktop` component; `DesktopIcon` is a thin presentational wrapper that just forwards `onMouseDown` / `onClick` / `onDoubleClick`.

`Desktop`'s `handleIconMouseDown(id, e)`:

1. Decides which ids ride the drag — the whole `selectedIds` set if the clicked icon was already part of a multi-selection, otherwise just the clicked icon (which also becomes the new sole selection).
2. Snapshots every dragged icon's pixel position into a local `initial` map. Stored cells are side-anchored, so the snapshot calls `iconPixelOf(pos, parentRect.width)` to translate back into screen pixels.
3. Registers document-level `mousemove` / `mouseup` listeners.
4. The first move past `ICON_DRAG_THRESHOLD` (5px) flips `didDrag = true` and locks `document.body.style.userSelect = "none"` so sweeping over chrome doesn't highlight text.
5. Each `mousemove` computes a single (dx, dy) shared by every dragged icon and **clamps** it against every dragged icon's bounds — so the most-restrictive icon sets the limit and the group moves rigidly.
6. `mouseup` dispatches `setIconPosition({ id, x, y, parentWidth })` for every dragged id; the slice's `snapToGrid` re-derives `(side, col, row)` from those pixel coords. Then it restores the user-select lock and sets `wasDraggedRef` so the trailing `click`/`dblclick` event doesn't also fire selection or open.

Render path:

- Icons that are part of the active drag render at `init + (dx, dy)` from the live `dragSession`, using `{ left, top }` (absolute pixels). The drag uses `left:` for both sides because the drag math operates in screen-absolute pixels.
- Icons at rest render via `iconStyleOf(cell)` — `{ left, top }` for left-side icons, `{ right, top }` for right-side icons — using the cell chosen by `resolveIconRenderCells(iconPositions, parentWidth, parentHeight)`. Resolution is **non-destructive** — `iconPositions` in Redux is never mutated, so when the viewport grows back to its original size every icon returns to where it was.

### Resize / zoom reflow

`resolveIconRenderCells` runs in two passes against the current grid (`maxColsPerSide × maxRows` derived from `parentSize` and the cell pitch exported by the slice). `maxColsPerSide = floor((W − 2·ICON_PADDING) / (2·ICON_COL_WIDTH))` — the cap is **per side**, not the desktop's total column count. Each side is anchored to its own edge: left col `c` spans pixels `[pad + c·W, pad + (c+1)·W]` and right col `c` spans `[W_total − pad − (c+1)·W, W_total − pad − c·W]`. Bounding `c` at `maxColsPerSide − 1` guarantees the two ranges never cross, so under aggressive zoom or a narrow window the reflow can't place left-overflow and right-overflow icons on top of each other in the middle of the desktop.

1. **Keep what fits** — every icon whose stored cell is `(col < maxColsPerSide, row < maxRows)` claims it, first-come first-served by registry order. The `setIconPosition` reducer prevents stored-cell duplicates so collisions in this pass don't normally happen.
2. **Reflow overflow** — any icon whose stored cell is out of bounds is placed in the first free `(col < maxColsPerSide, row < maxRows)` cell on its preferred side; if that side is full, it spills onto the other side. If both sides are full, the icon falls back to `(side: preferred, col: 0, row: 0)` — degraded but visible. Real workflows shouldn't hit this; the user can enlarge the desktop to recover their layout.

Memoized with `useMemo` so the two-pass algorithm only runs when `iconPositions` or `parentSize` changes — not on every render.

### Edge-anchored rendering — no parentWidth in the paint path

Each icon renders with edge-anchored CSS: `{ left, top }` for `side: "left"`, `{ right, top }` for `side: "right"`. The browser handles the right-edge anchoring natively, so right-side icons paint at the correct position even on the SSR HTML, before any measurement has happened. The render path therefore does **not** depend on `parentWidth` — the resolver returns reflowed `(side, col, row)` cells, and the renderer translates each cell to the appropriate `{ left | right, top }` via `iconStyleOf`.

`parentSize` is still measured (in a `useLayoutEffect` with a synchronous `getBoundingClientRect`, then a `ResizeObserver` for resize/zoom) — but only because the marquee intersection and the drag-start snapshot need absolute pixel coordinates (`iconPixelOf`). Both paths only fire from a user gesture, by which time the desktop is mounted and measured. Before measurement, the resolver short-circuits to the raw stored cells (skipping the two-pass reflow that would need `maxCols` / `maxRows`), and the render keeps working because `iconStyleOf` only needs the cell, not the parent size.

A previous iteration computed absolute `x` for every icon (`parentWidth - padding - col_width - col*…` for right-side icons) and used `left:` for everyone. With `parentWidth = 0` on the first render, right-side icons painted at x = -112 and snapped to the edge a frame later — a visible flash. Edge-anchored CSS eliminates the dependency at the source.

### Click / double-click semantics (Win2K classic)

- **Single click** → `handleIconClick(id, additive)` — replaces the selection (or toggles, with Ctrl/Cmd).
- **Double click** → `handleIconOpen(id)` — dispatches `openWindow` + `router.push`.
- Both handlers early-return if `wasDraggedRef.current` is set, so a real drag never accidentally triggers selection or open.
- **Click on empty desktop** → clears the selection.
- **Drag on empty desktop** → marquee selection (replaces selection with intersecting icons on release).

### Snap-to-grid + no-overlap by swap

The `setIconPosition` reducer:

1. Snaps the dropped position to the nearest grid cell — `snapToGrid(x, y, parentWidth)` decides side from the icon's center vs. the desktop midline, then converts the pixel offset into a `(col, row)` anchored to that side.
2. If another icon already occupies that `(side, col, row)` cell, the two **swap** — the existing tenant moves into the dragged icon's previous cell.
3. The dragged icon takes the target cell.

This preserves the invariant "at most one icon per cell" without ever rejecting a drop, and makes side-flipping a natural drag (drop on the right half → side becomes "right"). `resetIconPositions()` is exported from the slice for a future "auto-arrange" affordance; currently nothing calls it.

## Icons

Each window has a matching SVG at `web/public/icons/<id>.svg` — resolved by the `iconPath(def)` helper from the registry. The same SVG is reused at three different sizes (40px on the desktop, 18px in the start menu, 16px on the taskbar) — the `<img>` element scales the vector, no per-size variants needed.

The chrome components (`DesktopIcon`, `StartMenu`, `TaskbarButton`) render `<img src={iconPath(def)} alt="" aria-hidden style={...sizing}>`. The label below is what announces the page; the icon is decorative and aria-hidden.

Each ESG **area** (Environmental, Social, Governance, Objective) has its own SVG at `web/public/icons/areas/<area>.svg` — resolved by `areaIconPath(area)`. Used as the icon next to each top-level row in the Start menu, so an area row is visually distinct from any of its child windows. The `area` field on each registry entry no longer drives a background color — icons are descriptive on their own. `area` is still used by `windowsByArea(area)` to group items in the Start menu's four submenus.

## Window layer

Only the `activeId` window is rendered; every other open id stays in `s.windows.order` (and on the taskbar) but is not in the DOM:

```tsx
{activeId && <Window id={activeId} />}
```

There's no z-stack to manage — only one window is ever on screen. The frame paints above the marquee thanks to `theme.window.root.zIndex = 10`, and below the bottombar (`100`) and start menu (`200`) so chrome always covers it.

Switching foreground (taskbar click → `focusWindow`) changes `activeId`; React swaps the DOM child for the new window. The previous window's lazy chunk stays cached in the bundler so re-mounting is instant.

## Theme keys consumed

### `theme.desktop`

| Key         | Applied to                                                          |
| ----------- | ------------------------------------------------------------------- |
| `root`      | the `<div>` that fills the area above the bottombar                 |
| `marquee`   | the absolute-positioned rubber-band rectangle drawn during drag-to-select |
| `iconGrid`  | the absolute-positioned column-flow grid in the top-left corner     |

### `theme.desktopIcon`

| Key                                       | Applied to                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `root`                                    | each icon `<button>` (column with icon + label)                           |
| `rootHover` / `rootFocus` / `rootSelected` | merged on `root` — hover transient, selected sticky after a single click |
| `icon` / `iconSelected`                   | the 40×40 SVG `<img>` — sizing only; selected dims it slightly so the tint shows |
| `label` / `labelHover` / `labelSelected`  | the page name under the icon — hover and selected both flip bg to selection blue |

### `theme.window`

| Key                                | Applied to                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `root`                             | the centered window frame (`inset: 10%` → 80% of the desktop, scales with browser zoom)               |
| `rootMaximized`                    | merged on `root` while `s.windows.maximized[id]` is set — overrides to `inset: 0` (fills the desktop) |
| `titleBar` / `titleBarActive`      | the gradient bar; only the active variant is used at runtime since just one window is ever on screen  |
| `titleBarText`                     | the title text (truncates with ellipsis)                                                              |
| `buttonGroup`                      | right-aligned cluster holding the minimize / maximize / close buttons                                 |
| `iconButton` / `iconButtonHover` / `iconButtonFocus` / `iconButtonPressed` | shared shape for the three title-bar buttons; hover brightens the face, focus draws a dotted outline, pressed inverts the bevel |
| `body`                             | the white "document" outer surface — owns the sunken bevel and background; 2px of bevel-thickness padding so the scrollable child sits inside the bevel |
| `bodyContent`                      | inner scroll container nested in `body` — owns `overflow: auto` and the page padding, so the scrollbar paints inside the sunken frame instead of on top of the top-right bevel corner |

## Window placement

The window has no per-instance geometry. Default: `theme.window.root` sets `position: absolute; inset: 10%`, so the frame is 80% of the desktop and centered. The maximize button toggles `s.windows.maximized[id]`, which merges `theme.window.rootMaximized` (`inset: 0`) over the base — filling the desktop edge-to-edge. Browser zoom scales the frame along with everything else because the size is expressed in percentages, not pixels. There's no drag and no resize — see [Window manager](../architecture/window-manager.md) for the rationale.

## Hover / focus / pressed tracking

Inline styles can't express `:hover` / `:focus` / `:active` pseudo-classes, so each interactive element tracks the three states explicitly. Buttons share a [`useButtonState()`](../../lib/ui/useButtonState.ts) hook that bundles the six event handlers (`onMouseEnter` / `Leave` / `Down` / `Up` / `Focus` / `Blur`) and returns `{ state, handlers }`; the call site spreads `handlers` onto the `<button>` and merges the matching theme keys (`base → hover → focus → pressed`) into the `style` prop. `mouseLeave` clears both hover and pressed so dragging off doesn't strand the bevel inverted.

The StartButton is the one special case: pressed is OR'd with the menu-open flag, so the button stays visually pressed while the menu is open even after the mouse releases.

The merge order is **base → hover → focus → pressed** for buttons; for items (e.g. `DesktopIcon`'s `rootHover` / `rootSelected`) it's **base → hover → focus → active**, with selected/active being a sticky state set by click rather than a transient pointer state.
