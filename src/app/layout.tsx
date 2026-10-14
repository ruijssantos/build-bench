import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Martian_Mono, Saira_Condensed } from "next/font/google";

import "@/styles/tokens.css";

const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-saira-condensed",
  display: "swap",
});

// No `weight` on purpose: Hanken Grotesk is a variable font, so one file
// covers 400–800. Pinning the weights the design uses would make next/font
// ship one static instance per weight and preload all of them.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});

// Not preloaded: Martian Mono only sets small secondary labels (paint codes,
// the psi line, search hits) and never the largest text on any screen, so it
// has no business competing for bandwidth with the display and body faces
// during first paint. It still loads, just off the critical path.
const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-martian-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "The Build Bench",
    template: "%s · The Build Bench",
  },
  description: "Thinner ratios, paint inventory, kit research and build logs for 1:24 scale model cars.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Build Bench",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f4f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sairaCondensed.variable} ${hankenGrotesk.variable} ${martianMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
