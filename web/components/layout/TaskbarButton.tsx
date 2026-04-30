"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  minimizeWindow,
  restoreWindow,
  focusWindow,
} from "@/store/slices/windowsSlice";
import { getWindow, iconPath } from "@/lib/windows/registry";

export function TaskbarButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const def = getWindow(id);
  const isMinimized = useAppSelector((s) => s.windows.byId[id]?.isMinimized ?? false);

  if (!def) return null;

  // Win2K taskbar click semantics:
  // - minimized window  → restore + focus
  // - active visible    → minimize (clicking the active task button hides it)
  // - inactive visible  → focus (bring to front)
  const handleClick = () => {
    if (isMinimized) {
      dispatch(restoreWindow(id));
    } else if (isActive) {
      dispatch(minimizeWindow(id));
    } else {
      dispatch(focusWindow(id));
    }
    // Update URL to match the now-foreground window so reload keeps state.
    // replace() (not push) — focusing isn't a new history entry.
    router.replace(def.route);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      title={def.title}
      style={{
        ...theme.taskbarButton.root,
        ...(isActive && !isMinimized ? theme.taskbarButton.rootActive : null),
        ...(focused ? theme.taskbarButton.rootFocus : null),
      }}
    >
      <img
        src={iconPath(def)}
        alt=""
        aria-hidden
        style={theme.taskbarButton.icon}
      />
      <span style={theme.taskbarButton.label}>{def.title}</span>
    </button>
  );
}
