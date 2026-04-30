import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/store/Providers";
import { ThemeProvider } from "@/lib/themes";
import { Topbar } from "@/components/layout/Topbar";
import { Bottombar } from "@/components/layout/Bottombar";
import { Desktop } from "@/components/layout/Desktop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sostenibilità",
  description: "ESG monitoring",
};

// Cap pinch / touch zoom at 2×. The Win2K-style desktop has fixed-size
// chrome (taskbar, title bars, icons) that doesn't gain anything from
// being scaled past this point, and at higher zoom the desktop area
// shrinks enough that the auto-reflow in `Desktop.tsx` starts stacking
// icons in the bottom-right fallback. Note this only constrains
// touch / pinch zoom — desktop browser zoom (Ctrl + / -) is intentionally
// not constrained here, because hijacking the user's accessibility zoom
// would be a worse trade-off.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Providers>
          <ThemeProvider>
            {/* Three-row vertical stack: topbar (fixed) / desktop (flex 1)
                / bottombar (fixed). The Desktop owns the absolute-positioned
                window layer and receives `children` so each route's page.tsx
                can dispatch its openWindow side-effect. */}
            <div className="flex h-screen flex-col">
              <Topbar />
              <Desktop>{children}</Desktop>
              <Bottombar />
            </div>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
