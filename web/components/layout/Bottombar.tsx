"use client";

import { useTheme } from "@/lib/themes";
import { useAppSelector } from "@/store/hooks";
import { StartButton } from "./StartButton";
import { TaskbarButton } from "./TaskbarButton";
import { Clock } from "./Clock";

export function Bottombar() {
  const { theme } = useTheme();
  const order = useAppSelector((s) => s.windows.order);
  const activeId = useAppSelector((s) => s.windows.activeId);

  return (
    <footer style={theme.bottombar.root}>
      <StartButton />
      <span aria-hidden style={theme.bottombar.separator} />
      <div style={theme.bottombar.taskList}>
        {order.map((id) => (
          <TaskbarButton key={id} id={id} isActive={id === activeId} />
        ))}
      </div>
      <span aria-hidden style={theme.bottombar.separator} />
      <div style={theme.bottombar.systemTray}>
        <Clock />
      </div>
    </footer>
  );
}
