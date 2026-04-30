# App shell

The root layout assembles a Win2K-style three-row vertical stack inside the `<body>`:

```
┌──────────────────────────────────────────────────┐
│ Topbar                       (28px, blue band)   │
├──────────────────────────────────────────────────┤
│ Desktop                      (flex 1)            │
│   • wallpaper                                    │
│   • icons (absolute, snap-to-grid, draggable)    │
│   • windows (absolute, draggable + resizable)    │
├──────────────────────────────────────────────────┤
│ Bottombar                    (36px, taskbar)     │
└──────────────────────────────────────────────────┘
```

Each row is documented separately:

- [Topbar](../components/topbar.md)
- [Desktop](../components/desktop.md) — also covers icons, marquee selection, and the lifted drag pattern
- [Bottombar](../components/bottombar.md) — Start button + Start menu + taskbar buttons + clock
- [Window manager](window-manager.md) — Redux slice, registry, deep-link routing, drag/resize/min/max

This page captures cross-cutting decisions that don't belong to any single component.

## Viewport zoom cap

The root layout exports a `viewport` const with `maximumScale: 2`:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
};
```

This caps **pinch / touch zoom** on devices that respect the meta viewport (mobile, tablets, touchpad gestures). Beyond 2× the desktop area shrinks enough that the auto-reflow in `Desktop.tsx` runs out of free cells and starts stacking icons in the bottom-right fallback — capping the zoom keeps icons visually distinct.

Desktop browser zoom (Ctrl + / Ctrl -) is **intentionally not constrained**. The web platform doesn't expose a way to do that cleanly, and intercepting accessibility zoom would be a worse trade-off than the occasional layout overflow.

## User-select discipline

Two layers prevent accidental text selection:

1. **Chrome elements** that don't host editable content explicitly set `userSelect: "none"` in their theme slice — `topbar`, `bottombar`, `taskbarButton`, `startButton`, `desktopIcon`. This stops a single click from highlighting their labels.
2. **During an active drag** (icon drag, window drag, window resize, marquee selection), the handler that registers document-level `mousemove` / `mouseup` listeners also flips `document.body.style.userSelect = "none"` and restores it on release. Without this, dragging across the page would highlight any text the cursor sweeps over.

The two layers compose: chrome is permanently locked, the body gets locked only while a drag is in flight. The dynamic body lock is what catches the corner case where a marquee on the desktop sweeps over (for example) the bottombar — even though the bottombar itself is `user-select: none`, browser default behavior can still kick in if no explicit lock is on the body during the drag.

## The desktop is the only "live" surface

Topbar and bottombar are presentational; all interactivity (drag, drop, click-to-select, marquee, double-click open, etc.) happens inside the desktop area or inside an open window. This keeps event handling simple — there's no event-routing layer between chrome and content.
