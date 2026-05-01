"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch } from "@/store/hooks";
import { focusWindow, deactivateWindow } from "@/store/slices/windowsSlice";
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

  if (!def) return null;

  // Click semantics:
  // - active   → deactivate (hide the foreground window; this id stays open
  //              and on the taskbar, just not visible)
  // - inactive → focus (this id becomes the foreground window)
  const handleClick = () => {
    if (isActive) {
      dispatch(deactivateWindow());
    } else {
      dispatch(focusWindow(id));
      router.replace(def.route);
    }
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
        ...(isActive ? theme.taskbarButton.rootActive : null),
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
