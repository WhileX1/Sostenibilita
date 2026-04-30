# Desktop

Wallpaper, icon grid, and the layer that hosts open windows. Sits between the topbar and the bottombar in the root layout and owns the absolute-positioned coordinate system every `Window` lives in.

- Component: [`web/components/layout/Desktop.tsx`](../../components/layout/Desktop.tsx)
- Subcomponents: [`DesktopIcon.tsx`](../../components/layout/DesktopIcon.tsx), [`Window.tsx`](../../components/layout/Window.tsx)
- Theme slices: [`desktop.ts`](../../lib/themes/presets/defaultTheme/components/layout/desktop.ts), [`desktopIcon.ts`](../../lib/themes/presets/defaultTheme/components/layout/desktopIcon.ts), [`window.ts`](../../lib/themes/presets/defaultTheme/components/layout/window.ts)
- Mounted in: [`web/app/layout.tsx`](../../app/layout.tsx)

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Topbar                                                   │
├──────────────────────────────────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐                ┌────────────────┐         │
│ │EN│ │HR│ │CD│                │ Window         │         │
│ └──┘ └──┘ └──┘                ├────────────────┤         │
│ ┌──┐ ┌──┐ ┌──┐                │                │         │
│ │CO│ │IN│ │ET│                │                │         │
│ └──┘ └──┘ └──┘                └────────────────┘         │
│ …                                                        │
├──────────────────────────────────────────────────────────┤
│ [Start] │ task buttons …               │ [12:34]         │
└──────────────────────────────────────────────────────────┘
```

The icon grid is column-flow with `gridTemplateRows: repeat(7, 80px)`, so the 13 registered windows land as **7 + 6** across two columns. Adding a 14th window flows automatically; reaching 15 wraps to a third column. No code change needed unless you want a different shape.

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

The desktop is a **snap-to-grid** surface (Win2K "Align to Grid" semantics). Grid geometry lives in the slice:

- `ICON_COL_WIDTH` = 100, `ICON_ROW_HEIGHT` = 92, `ICON_PADDING` = 12, `ICONS_PER_COL` = 6.
- `autoPosition(index)` produces the initial column-flow layout — 13 entries land as 6 + 6 + 1 across three columns.
- `snapToGrid(x, y)` rounds a dropped pixel position to the nearest cell.

### Drag is owned by `Desktop`, not `DesktopIcon`

The Win2K-style "drag the whole selection at once" gesture means a single drag may move N icons. Coordinating that requires shared state, so all gesture logic lives in the `Desktop` component; `DesktopIcon` is a thin presentational wrapper that just forwards `onMouseDown` / `onClick` / `onDoubleClick`.

`Desktop`'s `handleIconMouseDown(id, e)`:

1. Decides which ids ride the drag — the whole `selectedIds` set if the clicked icon was already part of a multi-selection, otherwise just the clicked icon (which also becomes the new sole selection).
2. Snapshots every dragged icon's position into a local `initial` map.
3. Registers document-level `mousemove` / `mouseup` listeners.
4. The first move past `ICON_DRAG_THRESHOLD` (5px) flips `didDrag = true` and locks `document.body.style.userSelect = "none"` so sweeping over chrome doesn't highlight text.
5. Each `mousemove` computes a single (dx, dy) shared by every dragged icon and **clamps** it against every dragged icon's bounds — so the most-restrictive icon sets the limit and the group moves rigidly.
6. `mouseup` dispatches `setIconPosition` for every dragged id (with `init.x + dx, init.y + dy`), restores the user-select lock, and sets `wasDraggedRef` so the trailing `click`/`dblclick` event doesn't also fire selection or open.

Render path:

- Icons that are part of the active drag render at `init + (dx, dy)` from the live `dragSession`.
- Icons at rest render at the position chosen by `resolveIconRenderPositions(iconPositions, parentWidth, parentHeight)`. This is **non-destructive** — `iconPositions` in Redux is never mutated, so when the viewport grows back to its original size every icon returns to where it was.

### Resize / zoom reflow

`resolveIconRenderPositions` runs in two passes against the current grid (`cols × rows` derived from `parentSize` and the cell pitch exported by the slice):

1. **Keep what fits** — every icon whose stored cell is in-bounds claims it, first-come first-served by registry order. The `setIconPosition` reducer prevents stored-cell duplicates so collisions in this pass don't normally happen.
2. **Reflow overflow** — any icon whose stored cell is out of bounds is placed in the first free cell in column-flow scan order (col 0 rows 0..N, then col 1, …). If the grid is so small that no free cell exists, the icon falls back to the top-left corner — degraded but visible. The user can enlarge the desktop to recover their layout.

Memoized with `useMemo` so the two-pass algorithm only runs when `iconPositions` or `parentSize` changes — not on every render.

### Click / double-click semantics (Win2K classic)

- **Single click** → `handleIconClick(id, additive)` — replaces the selection (or toggles, with Ctrl/Cmd).
- **Double click** → `handleIconOpen(id)` — dispatches `openWindow` + `router.push`.
- Both handlers early-return if `wasDraggedRef.current` is set, so a real drag never accidentally triggers selection or open.
- **Click on empty desktop** → clears the selection.
- **Drag on empty desktop** → marquee selection (replaces selection with intersecting icons on release).

### Snap-to-grid + no-overlap by swap

The `setIconPosition` reducer:

1. Snaps the dropped position to the nearest grid cell.
2. If another icon already occupies that cell, the two **swap** — the existing tenant moves into the dragged icon's previous cell.
3. The dragged icon takes the target cell.

This preserves the invariant "at most one icon per cell" without ever rejecting a drop. `resetIconPositions()` is exported from the slice for a future "auto-arrange" affordance; currently nothing calls it.

## Icons

Each window has a matching SVG at `web/public/icons/<id>.svg` — resolved by the `iconPath(def)` helper from the registry. The same SVG is reused at three different sizes (32px on the desktop, 18px in the start menu, 16px on the taskbar) — the `<img>` element scales the vector, no per-size variants needed.

The chrome components (`DesktopIcon`, `StartMenu`, `TaskbarButton`) render `<img src={iconPath(def)} alt="" aria-hidden style={...sizing}>`. The label below is what announces the page; the icon is decorative and aria-hidden.

The `area` field on each registry entry no longer drives a background color — icons are descriptive on their own. `area` is still used by `windowsByArea(area)` to group items in the Start menu's four submenus.

## Window layer

Open windows are rendered as siblings of the icon grid, ordered by the `order` array from the Redux slice:

```tsx
{order.map((id, idx) => (
  <Window key={id} ... zIndex={WINDOW_Z_BASE + idx} />
))}
```

Z-order is purely from array position. Focusing a window is a `bringToFront` reducer that moves the id to the end of `order`; React diffs each window's `zIndex` prop and React rerenders nothing else. No DOM reordering, no `Element.prototype.appendChild` shenanigans.

`WINDOW_Z_BASE` is `10`, well below the bottombar (`100`) and start menu (`200`) so chrome always paints on top of windows.

## Theme keys consumed

### `theme.desktop`

| Key         | Applied to                                                          |
| ----------- | ------------------------------------------------------------------- |
| `root`      | the `<div>` that fills the area between topbar and bottombar        |
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

| Key                                            | Applied to                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `root`                                         | the absolute-positioned window frame                                                                  |
| `titleBar` / `titleBarActive`                  | the gradient bar (drag handle); active swaps the gray gradient for blue                               |
| `titleBarText`                                 | the title text (truncates with ellipsis)                                                              |
| `buttonGroup`                                  | right-aligned cluster holding the three icon buttons                                                  |
| `iconButton` / `iconButtonPressed`             | shared shape for the minimize / maximize / restore / close buttons; pressed inverts the bevel         |
| `body`                                         | the white "document" inner surface that hosts the lazy-loaded content                                 |
| `resizeEdgeN/S/E/W` / `resizeCornerNE/NW/SE/SW` | 8 absolute-positioned hit zones around the frame; cursors signal the resize direction                |

## Drag, resize, min/max

The window component owns the interaction logic:

- **Drag** is initiated by mousedown on the title bar (not on its child buttons — they `stopPropagation`). A document-level mousemove updates a *local* React state for live preview, and on mouseup the final position is dispatched once via `setWindowBounds`. Position is clamped to the desktop's content area.
- **Resize** works the same way, started by any of the 8 handles. The geometry transform is `applyResize(dir, dx, dy, init)` — moving the *opposite* edge to enforce the 240×160 minimum size — followed by `clampToParent`. While a resize is in flight, `document.body.style.cursor` is forced to the matching `*-resize` cursor so it doesn't flicker if the mouse leaves the 4px-wide handle strip.
- **Maximize** spans the desktop area only (not the topbar). The window root sets `inset: 0` while maximized, filling its parent without measuring it in JS. Drag and resize are no-ops while maximized; double-clicking the title bar toggles maximize.
- **Minimize** flips `isMinimized` in state; the desktop skips rendering minimized windows. Their taskbar buttons stay visible — clicking restores.

## Hover / focus / pressed tracking

All three components track interaction via local `useState` (one per concern). The same pattern as the previous sidebar — necessary because inline styles can't express `:hover`/`:focus`/`:active`. The merge order is **base → hover → focus → active** for items, and **base → pressed** for buttons; pressed state is OR'd between mouse-down and "menu open" for the StartButton.
