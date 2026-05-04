"use client";

import { useState } from "react";

export interface ButtonState {
  hover: boolean;
  focused: boolean;
  pressed: boolean;
}

export interface ButtonHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const REST: ButtonState = { hover: false, focused: false, pressed: false };

// Hover / focus / pressed tracker for a Win2K-style three-state button.
// Bundles the six event handlers each button needs (hover brightens the
// face, focus draws the dotted outline, pressed inverts the bevel) so each
// call site is one hook invocation instead of six setState bodies.
//
// `onMouseLeave` clears both hover *and* pressed so dragging the cursor off
// the button doesn't strand it visually-pressed once the mouse releases
// elsewhere.
export function useButtonState(): {
  state: ButtonState;
  handlers: ButtonHandlers;
} {
  const [state, setState] = useState<ButtonState>(REST);
  const handlers: ButtonHandlers = {
    onMouseEnter: () => setState((s) => ({ ...s, hover: true })),
    onMouseLeave: () =>
      setState((s) => ({ ...s, hover: false, pressed: false })),
    onMouseDown: () => setState((s) => ({ ...s, pressed: true })),
    onMouseUp: () => setState((s) => ({ ...s, pressed: false })),
    onFocus: () => setState((s) => ({ ...s, focused: true })),
    onBlur: () => setState((s) => ({ ...s, focused: false })),
  };
  return { state, handlers };
}
