/**
 * Which deployment this is. SITE_ENV=staging marks the Netlify test site; anything
 * else (including unset) is a normal environment. Server-side only, no secrets.
 *
 * - staging: behaves like dev for content (placeholders and flagged images visible with
 *   badges), shows a "Test site" banner, and is hidden from search engines.
 * - production: placeholders and flagged images are hidden.
 */
export const isStaging = process.env.SITE_ENV === "staging";

/** Show placeholder text and flagged images (with badges): everywhere except production. */
export const showPlaceholders = process.env.NODE_ENV !== "production" || isStaging;
