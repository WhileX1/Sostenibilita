"use client";

import { useRef, useState } from "react";
import { useTheme } from "@/lib/themes";
import { StartMenu } from "./StartMenu";

export function StartButton() {
  const { theme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  // Win2K: the Start button stays visually pressed for as long as the menu
  // is open, even after the mouse releases. So `pressed` ORs with `open`.
  const showPressed = open || pressed;

  // Toggle on click — fires for both mouse (after mouseup) and keyboard
  // (Enter/Space). The previous mousedown-toggle made the menu unreachable
  // from the keyboard since Enter/Space don't synthesize mousedown events.
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  // Esc-close from inside the menu returns focus here so a keyboard user
  // doesn't lose their place. Mouse-driven close (clicking outside) skips
  // the focus restore — the user is already engaging another surface.
  const handleEscapeClose = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-start-menu-trigger
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleClick}
        onMouseDown={() => setPressed(true)}
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
      {open && (
        <StartMenu
          onClose={() => setOpen(false)}
          onEscape={handleEscapeClose}
        />
      )}
    </>
  );
}
