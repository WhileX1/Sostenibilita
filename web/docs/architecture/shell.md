# App shell

The root layout assembles a Win2K-style three-row vertical stack inside the `<body>`:

```
┌──────────────────────────────────────────────────┐
│ Topbar                       (28px, blue band)   │
├──────────────────────────────────────────────────┤
│ Desktop                      (flex 1)            │
│   • wallpaper                                    │
│   • icons (absolute, side-anchored, draggable)   │
│   • foreground window (centered 80% or full)     │
├──────────────────────────────────────────────────┤
│ Bottombar                    (36px, taskbar)     │
└──────────────────────────────────────────────────┘
```

Each row is documented separately:

- [Topbar](../components/topbar.md)
- [Desktop](../components/desktop.md) — also covers icons, marquee selection, and the lifted drag pattern
- [Bottombar](../components/bottombar.md) — Start button + Start menu + taskbar buttons + clock
- [Window manager](window-manager.md) — Redux slice, registry, deep-link routing, single-foreground rendering, min/max

This page captures cross-cutting decisions that don't belong to any single component.

## Zoom

Two zoom mechanisms exist on the web; we treat them differently.

### Pinch / touch zoom — capped at 200%

The root layout exports a `viewport` const with `maximumScale: 2`:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
};
```

This caps pinch / touch zoom on devices that respect the meta viewport (mobile, tablets, touchpad gestures). Beyond 2× the desktop area shrinks enough that the icon grid runs out of free cells and starts stacking icons in the fallback corner — the cap keeps icons visually distinct.

The foreground window is unaffected by the cap. Its size is `inset: 10%` (80% of the desktop, centered) or `inset: 0` (full) so it scales proportionally with the desktop area; pinch-zoom shows the window's content larger and the frame just tracks the desktop bounds.

### Browser zoom (Ctrl + / Ctrl - / Ctrl + scroll) — intentionally uncapped

We deliberately do **not** cap desktop browser zoom, even though the user can drive it well past 200%. Two reasons:

1. **Accessibility.** Browser zoom is a primary accommodation for low-vision users, who routinely run at 200%-400%+. WCAG 2.1 SC 1.4.4 requires support up to 200%; capping it would push the experience below that bar for users who need it most.
2. **No clean implementation.** The web platform doesn't expose browser zoom as an API. Estimating it from `outerWidth / innerWidth` is heuristic and varies by browser; "compensating" with `transform: scale()` on `<html>` breaks `position: fixed`, stacking contexts, and pointer-event coordinates.

The current layout already degrades reasonably under high browser zoom: the centered window scales with the desktop (percentage-based), and the side-anchored icon grid reflows via `resolveIconRenderPositions` if columns no longer fit. At extreme zoom the icons collapse to the degraded fallback (col 0 of each side) — visible, even if cramped.

## User-select discipline

Two layers prevent accidental text selection:

1. **Chrome elements** that don't host editable content explicitly set `userSelect: "none"` in their theme slice — `topbar`, `bottombar`, `taskbarButton`, `startButton`, `desktopIcon`. This stops a single click from highlighting their labels.
2. **During an active drag** (icon drag, marquee selection), the handler that registers document-level `mousemove` / `mouseup` listeners also flips `document.body.style.userSelect = "none"` and restores it on release. Without this, dragging across the page would highlight any text the cursor sweeps over.

The two layers compose: chrome is permanently locked, the body gets locked only while a drag is in flight. The dynamic body lock is what catches the corner case where a marquee on the desktop sweeps over (for example) the bottombar — even though the bottombar itself is `user-select: none`, browser default behavior can still kick in if no explicit lock is on the body during the drag.

## The desktop is the only "live" surface

Topbar and bottombar are presentational; all interactivity (drag, drop, click-to-select, marquee, double-click open, etc.) happens inside the desktop area or inside an open window. This keeps event handling simple — there's no event-routing layer between chrome and content.
