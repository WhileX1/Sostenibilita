# Bottombar (taskbar)

Win2K-style taskbar pinned to the bottom of the viewport. Hosts the Start button, one task button per open window, and a system-tray clock.

- Component: [`web/components/layout/Bottombar.tsx`](../../components/layout/Bottombar.tsx)
- Subcomponents: [`StartButton.tsx`](../../components/layout/StartButton.tsx), [`StartMenu.tsx`](../../components/layout/StartMenu.tsx), [`TaskbarButton.tsx`](../../components/layout/TaskbarButton.tsx), [`Clock.tsx`](../../components/layout/Clock.tsx)
- Theme slices: [`bottombar.ts`](../../lib/themes/presets/defaultTheme/components/layout/bottombar.ts), [`startButton.ts`](../../lib/themes/presets/defaultTheme/components/layout/startButton.ts), [`startMenu.ts`](../../lib/themes/presets/defaultTheme/components/layout/startMenu.ts), [`taskbarButton.ts`](../../lib/themes/presets/defaultTheme/components/layout/taskbarButton.ts), [`clock.ts`](../../lib/themes/presets/defaultTheme/components/layout/clock.ts)
- Mounted in: [`web/app/layout.tsx`](../../app/layout.tsx) (third row of the layout's flex column)

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
- `mousedown` (not `click`) toggles the menu so it appears the instant the button presses, matching the OS behavior.
- The menu is rendered as a sibling of the button (a child of `StartButton`, not portaled). This keeps it inside the bottombar's stacking context, but it positions itself with `bottom: 36px` so it floats above the 36px-tall taskbar.

The menu has two columns: a vertical "Sostenibilità" banner (CSS `writing-mode: vertical-rl` + `transform: rotate(180deg)` for bottom-to-top text) and a list of the four ESG **areas**. Hovering / focusing an area expands a submenu showing that area's windows. The wrapping `<div>` around each area button + its submenu carries the `onMouseEnter` / `onMouseLeave`, so the cursor can travel from parent to submenu without firing a mouse-leave that would close it.

### Submenu positioning

Submenus deliberately use the **start menu root** as their positioning ancestor, not the area-row wrapper. The wrapper has no `position: relative`, so a child `position: absolute` skips up the tree until it hits the start menu root (the next positioned ancestor).

That lets every submenu apply `left: 100%, bottom: 3px` — anchoring its bottom edge to the start menu's bottom edge (which is itself anchored to the taskbar top). The submenu grows **upward** as it gets taller, and never starts below the taskbar regardless of which area row triggered it. Vertical alignment with the parent row is sacrificed in favor of "always above the taskbar"; in practice every area's submenu fits comfortably within the start menu's height.

Closing is multi-source:

- `Esc` key (document-level keydown listener while the menu is open).
- Click anywhere outside the menu, except on the trigger itself (the `data-start-menu-trigger` attribute opts the trigger out so its own toggle handler isn't fought).
- Activating an item launches the window and closes.

## TaskbarButton

One per open window, sourced from `s.windows.order` — which is **insertion order** (append on `openWindow` of a new id, splice on `closeWindow`). The slice never mutates `order` on focus changes, so a button stays in the same slot as the user shuffles between windows. Z-stack lives on each window's `zIndex` field, decoupled from the taskbar's layout. See the [window manager](../architecture/window-manager.md) doc for the full split.

- Active window's button has a **sunken bevel + 1px diagonal hatch** (Win2K used a 50% gray dither). The bevel inversion alone is too subtle on the beige surface, so the hatch is what really sells the active state. Minimized windows are drawn with the raised bevel even when their id is the `activeId`, so the user can tell from the bar whether the window is hidden.
- Click semantics depend on state (Win2K behavior):
  - minimized → `restoreWindow(id)`
  - active visible → `minimizeWindow(id)` (clicking the active task button hides the window)
  - inactive visible → `focusWindow(id)`
- All three paths call `router.replace(def.route)` so the URL tracks the foreground window.
- The 16×16 icon is the same SVG used on the desktop and in the start menu — sized via `theme.taskbarButton.icon`, no per-area variants.

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
