"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeWindow,
  deactivateWindow,
  toggleMaximize,
} from "@/store/slices/windowsSlice";
import { getWindow } from "@/lib/windows/registry";
import { useButtonState, type ButtonState } from "@/lib/ui/useButtonState";

// Title-bar glyphs — drawn at the same 14×14 grid so visual weight matches.
function MinimizeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="3" y="10" width="8" height="2" fill="#000" />
    </svg>
  );
}
function MaximizeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2" y="2" width="10" height="10" fill="none" stroke="#000" strokeWidth="1.5" />
      <rect x="2" y="2" width="10" height="3" fill="#000" />
    </svg>
  );
}
function RestoreGlyph() {
  // The two overlapping rectangles are filled with the button face
  // colour (Win2K beige) — not pure white — so the front rect
  // properly *occludes* the back rect's overlap region while staying
  // visually inside the title-bar's grey-beige palette. Reads from the
  // `--surface-primary` CSS var in `globals.css` so the SVG follows
  // the same theme token the JS-side button background uses.
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2" y="4" width="7" height="7" fill="var(--surface-primary)" stroke="#000" strokeWidth="1.2" />
      <rect x="4" y="2" width="7" height="7" fill="var(--surface-primary)" stroke="#000" strokeWidth="1.2" />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <line x1="3" y1="3" x2="11" y2="11" stroke="#000" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="11" x2="11" y2="3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Window({ id }: { id: string }) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const def = getWindow(id);
  const isMaximized = useAppSelector((s) => Boolean(s.windows.maximized[id]));

  const minimize = useButtonState();
  const maximize = useButtonState();
  const close = useButtonState();

  // Esc minimises the foreground window — standard role="dialog" dismiss
  // gesture. Skipped while a [role="menu"] is mounted (e.g. the open
  // StartMenu) so the menu's own Esc-to-close handler wins instead of
  // both firing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="menu"]')) return;
      dispatch(deactivateWindow());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dispatch]);

  if (!def) return null;
  const Content = def.Component;

  const handleMinimize = () => dispatch(deactivateWindow());
  const handleToggleMax = () => dispatch(toggleMaximize(id));
  const handleClose = () => {
    dispatch(closeWindow(id));
    if (pathname === def.route) router.replace("/");
  };

  // Compose hover + focus + pressed onto the base button style. Pressed
  // wins so the bevel inversion reads even while the cursor is still over
  // the button; focus draws an independent dotted outline so it shows
  // alongside any other state.
  const buttonStyle = (s: ButtonState) => ({
    ...theme.window.iconButton,
    ...(s.hover ? theme.window.iconButtonHover : null),
    ...(s.focused ? theme.window.iconButtonFocus : null),
    ...(s.pressed ? theme.window.iconButtonPressed : null),
  });

  return (
    <div
      role="dialog"
      aria-label={def.title}
      style={{
        ...theme.window.root,
        ...(isMaximized ? theme.window.rootMaximized : null),
      }}
    >
      <div
        style={{
          ...theme.window.titleBar,
          ...theme.window.titleBarActive,
        }}
      >
        <span style={theme.window.titleBarText}>{def.title}</span>
        <span style={theme.window.buttonGroup}>
          <button
            type="button"
            aria-label="Minimize"
            {...minimize.handlers}
            onClick={handleMinimize}
            style={buttonStyle(minimize.state)}
          >
            <MinimizeGlyph />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? "Restore" : "Maximize"}
            {...maximize.handlers}
            onClick={handleToggleMax}
            style={buttonStyle(maximize.state)}
          >
            {isMaximized ? <RestoreGlyph /> : <MaximizeGlyph />}
          </button>
          <button
            type="button"
            aria-label="Close"
            {...close.handlers}
            onClick={handleClose}
            style={buttonStyle(close.state)}
          >
            <CloseGlyph />
          </button>
        </span>
      </div>
      <div style={theme.window.body}>
        <div style={theme.window.bodyContent}>
          <Suspense fallback={<p>Loading…</p>}>
            <Content />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
