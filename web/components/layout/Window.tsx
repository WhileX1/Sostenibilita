"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeWindow,
  deactivateWindow,
  toggleMaximize,
} from "@/store/slices/windowsSlice";
import { getWindow } from "@/lib/windows/registry";

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
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2" y="4" width="7" height="7" fill="#fff" stroke="#000" strokeWidth="1.2" />
      <rect x="4" y="2" width="7" height="7" fill="#fff" stroke="#000" strokeWidth="1.2" />
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

// Tracking hover + focus + pressed for each title-bar button. Local state
// because inline styles can't express CSS pseudo-classes — same pattern the
// start button and taskbar buttons use.
interface ButtonState {
  hover: boolean;
  focused: boolean;
  pressed: boolean;
}
const REST: ButtonState = { hover: false, focused: false, pressed: false };

export function Window({ id }: { id: string }) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const def = getWindow(id);
  const isMaximized = useAppSelector((s) => Boolean(s.windows.maximized[id]));

  const [minState, setMinState] = useState<ButtonState>(REST);
  const [maxState, setMaxState] = useState<ButtonState>(REST);
  const [closeState, setCloseState] = useState<ButtonState>(REST);

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
            onMouseEnter={() => setMinState((s) => ({ ...s, hover: true }))}
            onMouseLeave={() => setMinState((s) => ({ ...s, hover: false, pressed: false }))}
            onMouseDown={() => setMinState((s) => ({ ...s, pressed: true }))}
            onMouseUp={() => setMinState((s) => ({ ...s, pressed: false }))}
            onFocus={() => setMinState((s) => ({ ...s, focused: true }))}
            onBlur={() => setMinState((s) => ({ ...s, focused: false }))}
            onClick={handleMinimize}
            style={buttonStyle(minState)}
          >
            <MinimizeGlyph />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? "Restore" : "Maximize"}
            onMouseEnter={() => setMaxState((s) => ({ ...s, hover: true }))}
            onMouseLeave={() => setMaxState((s) => ({ ...s, hover: false, pressed: false }))}
            onMouseDown={() => setMaxState((s) => ({ ...s, pressed: true }))}
            onMouseUp={() => setMaxState((s) => ({ ...s, pressed: false }))}
            onFocus={() => setMaxState((s) => ({ ...s, focused: true }))}
            onBlur={() => setMaxState((s) => ({ ...s, focused: false }))}
            onClick={handleToggleMax}
            style={buttonStyle(maxState)}
          >
            {isMaximized ? <RestoreGlyph /> : <MaximizeGlyph />}
          </button>
          <button
            type="button"
            aria-label="Close"
            onMouseEnter={() => setCloseState((s) => ({ ...s, hover: true }))}
            onMouseLeave={() => setCloseState((s) => ({ ...s, hover: false, pressed: false }))}
            onMouseDown={() => setCloseState((s) => ({ ...s, pressed: true }))}
            onMouseUp={() => setCloseState((s) => ({ ...s, pressed: false }))}
            onFocus={() => setCloseState((s) => ({ ...s, focused: true }))}
            onBlur={() => setCloseState((s) => ({ ...s, focused: false }))}
            onClick={handleClose}
            style={buttonStyle(closeState)}
          >
            <CloseGlyph />
          </button>
        </span>
      </div>
      <div style={theme.window.body}>
        <Suspense fallback={<p>Loading…</p>}>
          <Content />
        </Suspense>
      </div>
    </div>
  );
}
