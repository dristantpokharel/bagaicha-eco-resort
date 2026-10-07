/**
 * Static site identity used before the database is available (metadata,
 * login screen). Editable business details (phone, email, address, socials)
 * live in the BusinessInfo table, not here.
 */

/**
 * Public origin for metadata and canonical URLs. Set NEXT_PUBLIC_SITE_URL in
 * production (value in .env.example); local dev falls back to localhost.
 * `new URL` throws at startup if the value is malformed.
 */
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export const SITE = {
  name: "Bagaicha Eco Resort",
  tagline: "Where nature meets comfort",
  /** Intro line under the hero and default meta description (from the brochure). */
  description: "A perfect escape in the heart of Bardiya",
  /** Postal address (docs/design.md). Phone and email live in BusinessInfo. */
  address: "Khairi, Gulariya-3, Bardiya, Nepal",
  url: siteUrl,
} as const;

/** Share-card fallback (the logo on cream, 1200x630) for pages without their own photo. */
export const DEFAULT_OG_IMAGE = {
  url: "/brand/og-default.jpg",
  width: 1200,
  height: 630,
  alt: `${SITE.name} logo`,
} as const;
