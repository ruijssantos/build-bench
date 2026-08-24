import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "@/styles/tokens.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
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
  themeColor: "#f6f2e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${plusJakartaSans.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
