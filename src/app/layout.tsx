import type { Metadata } from "next";
import { Montserrat, Red_Hat_Display, Source_Sans_3 } from "next/font/google";
import { DEFAULT_OG_IMAGE, SITE } from "@/config/site";
import "./globals.css";

// Brochure fonts (docs/design-tokens.md §2). Seravek isn't licensed for web, so
// titles use Source Sans 3, the owner-approved stand-in.
const title = Source_Sans_3({ variable: "--font-title", subsets: ["latin"], style: ["normal", "italic"] });
const redHat = Red_Hat_Display({ variable: "--font-red-hat", subsets: ["latin"], style: ["normal", "italic"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: SITE.url,
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  icons: {
    icon: [
      { url: "/brand/logo-only.svg", type: "image/svg+xml" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: { siteName: SITE.name, type: "website", locale: "en", images: [DEFAULT_OG_IMAGE] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. dark-mode ones) add attributes to <html>
    // before React loads. It only silences attribute mismatches on this element, not its children.
    <html
      lang="en"
      className={`${title.variable} ${redHat.variable} ${montserrat.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
