import type { Metadata } from "next";
import { Montserrat, Red_Hat_Display, Source_Sans_3 } from "next/font/google";
import { SITE } from "@/config/site";
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
  openGraph: { siteName: SITE.name, type: "website", locale: "en" },
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
