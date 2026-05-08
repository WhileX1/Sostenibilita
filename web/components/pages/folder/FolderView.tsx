"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/themes";
import { useAppDispatch } from "@/store/hooks";
import {
  deactivateWindow,
  openWindow,
} from "@/store/slices/windowsSlice";
import {
  allFolders,
  folderChildren,
  iconPath,
  type WindowArea,
  type WindowDefinition,
} from "@/lib/windows/registry";

// Icon for the "Desktop" entry in the quick-access sidebar. Lives at
// the top of `/public/icons/` (not under any registry-id-shaped path)
// because the desktop isn't a registered window — clicking it just
// minimises the foreground via `deactivateWindow` so the wallpaper
// shows through.
const DESKTOP_ICON = "/icons/desktop.svg";

// One icon button inside a folder window's metric grid. Mirrors the
// desktop's large-icon look (40px artwork + label) but doesn't carry
// drag / marquee selection — clicks here are pure navigation. Double
// click matches the desktop's open gesture; Enter / Space activate via
// the native button click for keyboard users.
function GridItem({
  def,
  onOpen,
}: {
  def: WindowDefinition;
  onOpen: (id: string) => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <button
      type="button"
      onDoubleClick={() => onOpen(def.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(def.id);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...theme.pages.folderView.item,
        ...(hovered ? theme.pages.folderView.itemHover : null),
        ...(focused ? theme.pages.folderView.itemFocus : null),
      }}
    >
      <img
        src={iconPath(def)}
        alt=""
        aria-hidden
        draggable={false}
        style={theme.pages.folderView.itemIcon}
      />
      <span
        style={{
          ...theme.pages.folderView.itemLabel,
          ...(hovered ? theme.pages.folderView.itemLabelHover : null),
        }}
      >
        {def.title}
      </span>
    </button>
  );
}

// Quick-access entry — single-click navigation widget. `current` paints
// the row in the sticky selected state (blue) and turns the click into
// a no-op so the user can see where they are without it being an active
// target. Tab focus still lands on the row so keyboard navigation stays
// uniform across all rows.
function SidebarItem({
  label,
  iconSrc,
  onClick,
  current = false,
}: {
  label: string;
  iconSrc: string;
  onClick: () => void;
  current?: boolean;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const interactive = !current;
  return (
    <button
      type="button"
      onClick={() => {
        if (interactive) onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-current={current ? "page" : undefined}
      style={{
        ...theme.pages.folderView.sidebarItem,
        // Current wins over hover/focus so the "you are here" cue stays
        // stable even when the cursor passes over the row.
        ...(interactive && (hovered || focused)
          ? theme.pages.folderView.sidebarItemHover
          : null),
        ...(current ? theme.pages.folderView.sidebarItemCurrent : null),
      }}
    >
      <img
        src={iconSrc}
        alt=""
        aria-hidden
        draggable={false}
        style={theme.pages.folderView.sidebarItemIcon}
      />
      <span>{label}</span>
    </button>
  );
}

// Folder window body — left "Accesso rapido" sidebar (Desktop + every
// folder) plus a fluid grid of the current area's scored metrics. The
// sidebar lets the user pivot without going back to the wallpaper;
// clicking Desktop minimises the foreground via `deactivateWindow` so
// the wallpaper shows through (the folder window stays in the taskbar
// for one-click return). Clicking another folder opens / focuses that
// folder window. The current folder paints as the sticky selection so
// the user can see where they are.
export function FolderView({ area }: { area: WindowArea }) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const items = folderChildren(area);
  const folders = allFolders();

  const goDesktop = () => {
    // Send every window to the background — the wallpaper paints
    // through the now-empty foreground slot. Routes are reset to the
    // root so a refresh doesn't immediately reopen this folder via
    // `useOpenWindowOnMount`. `replace` keeps the back-button stack
    // tidy: the user can still hit Back to return to the folder if
    // they want, but the sidebar Desktop click itself doesn't pile a
    // history entry.
    dispatch(deactivateWindow());
    router.replace("/");
  };

  const goFolder = (def: WindowDefinition) => {
    dispatch(openWindow(def.id));
    router.push(def.route);
  };

  const openMetric = (id: string) => {
    const def = items.find((w) => w.id === id);
    if (!def) return;
    dispatch(openWindow(def.id));
    router.push(def.route);
  };

  return (
    <div style={theme.pages.folderView.root}>
      <aside style={theme.pages.folderView.sidebar} aria-label="Accesso rapido">
        <div style={theme.pages.folderView.sidebarTitle}>Accesso rapido</div>
        <SidebarItem
          label="Desktop"
          iconSrc={DESKTOP_ICON}
          onClick={goDesktop}
        />
        {folders.map((def) => (
          <SidebarItem
            key={def.id}
            label={def.title}
            iconSrc={iconPath(def)}
            onClick={() => goFolder(def)}
            current={def.area === area}
          />
        ))}
      </aside>
      <div style={theme.pages.folderView.grid}>
        {items.map((def) => (
          <GridItem key={def.id} def={def} onOpen={openMetric} />
        ))}
      </div>
    </div>
  );
}
