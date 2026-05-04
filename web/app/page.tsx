// Root route — the desktop is always rendered by the root layout, so the
// landing page itself produces no UI. Visiting "/" simply means "no window
// targeted by the URL", and the Desktop in the layout shows the wallpaper
// + icons behind any windows that may be open.
export default function Home() {
  return null;
}
