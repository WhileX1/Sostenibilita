# Bottombar (taskbar)

Win2K-style taskbar pinned to the bottom of the viewport. Hosts the Start button, one task button per open window, and a system-tray clock.

- Component: [`web/components/layout/Bottombar.tsx`](../../components/layout/Bottombar.tsx)
- Subcomponents: [`StartButton.tsx`](../../components/layout/StartButton.tsx), [`StartMenu.tsx`](../../components/layout/StartMenu.tsx), [`TaskbarButton.tsx`](../../components/layout/TaskbarButton.tsx), [`Clock.tsx`](../../components/layout/Clock.tsx)
- Theme slices: [`bottombar.ts`](../../lib/themes/presets/defaultTheme/components/layout/bottombar.ts), [`startButton.ts`](../../lib/themes/presets/defaultTheme/components/layout/startButton.ts), [`startMenu.ts`](../../lib/themes/presets/defaultTheme/components/layout/startMenu.ts), [`taskbarButton.ts`](../../lib/themes/presets/defaultTheme/components/layout/taskbarButton.ts), [`clock.ts`](../../lib/themes/presets/defaultTheme/components/layout/clock.ts)
- Mounted in: [`web/app/layout.tsx`](../../app/layout.tsx) (second row of the layout's flex column)

## Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ [⊞ Start] │ [EN Energy …] [CO CO₂ Emissions]            │ 12:34 │
└──────────────────────────────────────────────────────────────┘
   ▲           ▲                                            ▲
   │           │                                            └─ Clock (system tray, sunken bevel)
   │           └─ Task buttons (one per open window, active = sunken + hatch)
   └─ Start button (sunken while menu is open)
```

Layout is a single horizontal flex row. The two `theme.bottombar.separator` spans are the carved 2px grooves between Start ↔ task list and task list ↔ system tray.

## StartButton + StartMenu

Together these implement the Win2K Start affordance:

- The button is a `<button data-start-menu-trigger>` with the official Windows 1992-2001 SVG logo (`/Windows_Logo_(1992-2001).svg`) + the word **Start**. While the menu is open, the button stays visually pressed (`pressed = mouseDown || open`) — a Win2K signature.
- The toggle fires on `click`, not `mousedown`, so the menu opens for both mouse users (after mouseup) and keyboard users (Enter/Space synthesize a click but never a mousedown). The slight loss of "instant" feel is the cost of being keyboard-reachable.
- The menu is rendered as a sibling of the button (a child of `StartButton`, not portaled). This keeps it inside the bottombar's stacking context, but it positions itself with `bottom: 40px` so it floats above the 40px-tall taskbar.

The menu has two columns: a vertical "Sostenibilità" banner (CSS `writing-mode: vertical-rl` + `transform: rotate(180deg)` for bottom-to-top text) and a list of the four ESG **areas**. Each area row uses its dedicated SVG from `areaIconPath(area)` — see [`web/public/icons/areas/`](../../public/icons/areas/) — so the top-level rows look distinct from any of their child windows. Hovering / focusing an area expands a submenu showing that area's windows.

The cursor traveling from an area row to its submenu has to cross a horizontal gap (the submenu is anchored to the start menu root, not the row, so it floats fixed at the right edge — see "Submenu positioning" below). To stop that gap traversal from accidentally closing the submenu, `mouseLeave` calls `scheduleClose(area)` instead of clearing `openArea` directly: a 250ms timer is started, and any subsequent `mouseEnter` (this row's, an adjacent row's, or the submenu's own ancestry — the submenu is a DOM descendant of the row wrapper) cancels it. The delay is short enough to feel snappy when the user actually intends to close (e.g., moving onto the desktop) and long enough to cover a deliberate diagonal traversal.

### Keyboard navigation

The menu is fully usable from the keyboard:

- **Open**: Enter or Space on the focused Start button.
- **Auto-focus on open**: `useEffect` focuses the first area button (Environmental) so the user lands inside the menu without an extra Tab.
- **Up / Down**: cycle through area buttons (and submenu items, when focused inside a submenu). Wraps at the ends.
- **Right** on an area: open its submenu and focus the first item. `requestAnimationFrame` waits for the ref callback to populate `submenuRefs` before focusing.
- **Left** on a submenu item: return focus to the parent area button. The submenu stays open (collapsing it on Left would surprise the user — they're stepping back, not undoing).
- **Left** on an area button: dispatch `onEscape` (no further "back" available).
- **Enter / Space** on a submenu item: launch the window (native button click; no special handler).
- **Esc**: dispatch `onEscape`. The Start button passes a callback that closes the menu **and** restores focus to the trigger so the user doesn't lose their place.
- **Click outside**: dispatch `onClose` (no focus restore — the user is engaging another surface, mouse-driven).

Area / submenu buttons keep their `onFocus={() => setOpenArea(area)}` so Tab navigation also works: tabbing onto an area expands its submenu, and the submenu items are next in DOM order.

### Submenu positioning

Submenus deliberately use the **start menu root** as their positioning ancestor, not the area-row wrapper. The wrapper has no `position: relative`, so a child `position: absolute` skips up the tree until it hits the start menu root (the next positioned ancestor).

That lets every submenu apply `left: 100%, bottom: 3px` — anchoring its bottom edge to the start menu's bottom edge (which is itself anchored to the taskbar top). The submenu grows **upward** as it gets taller, and never starts below the taskbar regardless of which area row triggered it. Vertical alignment with the parent row is sacrificed in favor of "always above the taskbar"; in practice every area's submenu fits comfortably within the start menu's height.

Closing is multi-source:

- `Esc` key (document-level keydown listener while the menu is open).
- Click anywhere outside the menu, except on the trigger itself (the `data-start-menu-trigger` attribute opts the trigger out so its own toggle handler isn't fought).
- Activating an item launches the window and closes.

## TaskbarButton

One per open window, sourced from `s.windows.order` — which is **insertion order** (append on `openWindow` of a new id, splice on `closeWindow`). The slice never mutates `order` when `activeId` changes, so a button stays in the same slot as the user switches between windows. The single-foreground design means there's no z-stack to layer with — the taskbar's only job is to track open ids and let the user pick the one to bring up. See the [window manager](../architecture/window-manager.md) doc for the full state shape.

- The active window's button has a **sunken bevel + 1px diagonal hatch** (Win2K used a 50% gray dither). The bevel inversion alone is too subtle on the beige surface, so the hatch is what really sells the active state. When `activeId` is `null` (every window deactivated), no button shows the active style — every open id is "open in the background".
- Click semantics:
  - inactive → `focusWindow(id)` + `router.replace(def.route)` (this id becomes the foreground window).
  - active   → `deactivateWindow()` (clicking the active button hides the foreground; every id stays open and on the taskbar). The URL is left alone.
- The 16×16 icon is the same SVG used on the desktop and in the start menu — sized via `theme.taskbarButton.icon`, no per-area variants.

### Overflow — shrink to icon, never scroll

The task list is a flex row with `overflow: hidden` and the buttons are `flex-shrink: 1`. Each button's natural width sits between `minWidth: 44px` (icon-only fallback) and `maxWidth: 220px` (comfortable label width). As more windows open, flex distributes the deficit across the row and labels ellipsize until they collapse to 0; below that, each button is just an icon. The full title is still reachable through the `title` attribute on the button (native tooltip).

We deliberately don't make the task list horizontally scrollable. With a 13-window registry cap, even the worst case is `13 × 44 = 572px` — fits in any practical viewport — and a horizontal scrollbar at screen bottom would clash with the Win2K aesthetic (which never had one; classic Windows just shrunk the buttons). If the registry ever grew beyond what fits at icon width, that's the moment to revisit, not before.

## Clock

`useSyncExternalStore` subscribes to the wall clock — `getServerSnapshot` returns `""` so SSR doesn't try to render a time the client wouldn't agree with, and `subscribe` waits until the next minute boundary before starting the 60s interval (so the displayed time changes when the user expects it to).

## Theme keys consumed

### `theme.bottombar`

| Key            | Applied to                                                              |
| -------------- | ----------------------------------------------------------------------- |
| `root`         | the `<footer>` taskbar strip                                            |
| `separator`    | each carved 2px vertical groove                                         |
| `taskList`     | flex container for `TaskbarButton`s; `overflow: hidden` truncates       |
| `systemTray`   | sunken-bevel right-side area that hosts the clock                       |

### `theme.startButton`

| Key                                  | Applied to                                                                |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `root` / `rootPressed` / `rootFocus` | the button; pressed inverts the bevel; focus draws the dotted rect        |
| `logo`                               | sizing for the `<img>` rendering the Windows 1992-2001 SVG logo           |
| `label`                              | the "Start" text                                                          |

### `theme.startMenu`

| Key                                                 | Applied to                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `root`                                              | the popover (raised bevel + drop shadow, `bottom: 30px`)                      |
| `banner`                                            | left-side vertical strip with the rotated brand text                          |
| `list`                                              | content column to the right of the banner                                     |
| `item` / `itemHover`                                | each menu row (button); hover paints the selection blue                       |
| `itemArrow`                                         | the `▶` glyph at the right edge of submenu-bearing rows                       |
| `itemIcon`                                          | sizing for the small 18×18 SVG `<img>` inside each row                        |
| `separator`                                         | horizontal groove between menu groups                                         |
| `submenu`                                           | the floating second-level panel positioned to the right of its parent row     |

### `theme.taskbarButton`

| Key                                   | Applied to                                                                |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `root` / `rootActive` / `rootFocus`   | the button; active = sunken bevel + diagonal hatch background             |
| `icon`                                | sizing for the 16×16 SVG `<img>` inside the button                        |
| `label`                               | the title text (truncates with ellipsis)                                  |

### `theme.clock`

| Key    | Applied to                                                                |
| ------ | ------------------------------------------------------------------------- |
| `root` | the `<span>` showing `HH:MM` (tabular numbers so digits don't shift)      |
