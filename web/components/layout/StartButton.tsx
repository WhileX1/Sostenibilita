"use client";

import { useState } from "react";
import { useTheme } from "@/lib/themes";
import { StartMenu } from "./StartMenu";

export function StartButton() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  // Win2K: the Start button stays visually pressed for as long as the menu
  // is open, even after the mouse releases. So `pressed` ORs with `open`.
  const showPressed = open || pressed;

  // Toggle on mousedown (not click) to match Win2K — the menu appears the
  // instant the button presses, and clicking the same button again while
  // the menu is open dismisses it.
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPressed(true);
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        type="button"
        data-start-menu-trigger
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={handleMouseDown}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...theme.startButton.root,
          ...(showPressed ? theme.startButton.rootPressed : null),
          ...(focused ? theme.startButton.rootFocus : null),
        }}
      >
        <img
          src="/Windows_Logo_(1992-2001).svg"
          alt=""
          aria-hidden
          style={theme.startButton.logo}
        />
        <span style={theme.startButton.label}>Start</span>
      </button>
      {open && <StartMenu onClose={() => setOpen(false)} />}
    </>
  );
}
