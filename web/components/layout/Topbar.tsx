"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/themes";

function formatPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 0 ? "/" : "/ " + segments.join(" / ");
}

export function Topbar() {
  const { theme } = useTheme();
  const pathname = usePathname() ?? "/";
  return (
    <header style={theme.topbar.root}>
      <span style={theme.topbar.brand}>{formatPath(pathname)}</span>
    </header>
  );
}
