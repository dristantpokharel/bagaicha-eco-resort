/**
 * Static site identity used before the database is available (metadata,
 * login screen). Editable business details (phone, email, address, socials)
 * live in the BusinessInfo table, not here.
 */
export const SITE = {
  name: "Bagaicha Eco Resort",
  tagline: "Where nature meets comfort",
} as const;
