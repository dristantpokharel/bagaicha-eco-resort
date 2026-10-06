import type { Metadata } from "next";
import { Montserrat, Red_Hat_Display, Source_Sans_3 } from "next/font/google";
import { SITE } from "@/config/site";
import "./globals.css";

// Brochure fonts (docs/design-tokens.md §2). Seravek isn't licensed for web, so
// titles use a Google stand-in; Source Sans 3 until the owner picks one.
const title = Source_Sans_3({ variable: "--font-title", subsets: ["latin"], style: ["normal", "italic"] });
const redHat = Red_Hat_Display({ variable: "--font-red-hat", subsets: ["latin"], style: ["normal", "italic"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${title.variable} ${redHat.variable} ${montserrat.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
