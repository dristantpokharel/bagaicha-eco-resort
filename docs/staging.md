# Staging deployment (staging.bagaichaecoresort.com)

Staging is the same app as production with `SITE_ENV=staging`. It runs on Netlify, against its **own** Neon database, so tests never touch live data.

## What `SITE_ENV=staging` does

- Placeholders and flagged images show with their badges, like dev (production hides them).
- A thin "Test site — not live" strip sits at the bottom of every public page.
- Hidden from search: `<meta name="robots">`, an `X-Robots-Tag` header on every response, and `robots.txt` disallowing everything. `/sitemap.xml` returns 404.
- Emails never reach real people: with no `EMAIL_DEV_TO` set, staging sends **no** email at all.

Password gate: when `STAGING_PASSWORD` is set, every route asks for HTTP basic auth (any username, that password). Only `/_next/static/*`, `/.netlify/*` and `/robots.txt` are open. Admin login still applies on top of it. Leave `STAGING_PASSWORD` unset and the gate is off.

## Environment variables (names only)

Set these in Netlify → Site configuration → Environment variables. Values come from you; none are in the repo.

| Name | What it is for |
| --- | --- |
| `SITE_ENV` | `staging`. Turns on the staging behaviour above. |
| `STAGING_PASSWORD` | The password for the basic-auth gate. |
| `NEXT_PUBLIC_SITE_URL` | Public origin (`https://staging.bagaichaecoresort.com`). Used for canonical URLs, share images and email links. Read at **build** time, so changing it needs a redeploy. |
| `DATABASE_URL` | Neon **pooled** connection string. The running app uses it. |
| `DIRECT_URL` | Neon **direct** (non-pooled) connection string. `prisma migrate deploy` uses it during the build. |
| `AUTH_SECRET` | Signs Auth.js session tokens. Generate a new one for staging; don't reuse production's. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name (image URLs). |
| `CLOUDINARY_API_KEY` | Cloudinary API key (uploads from admin). |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (signing uploads). |
| `RESEND_API_KEY` | Sends email through Resend. |
| `EMAIL_FROM` | The "from" address (must be on a domain verified in Resend). |
| `EMAIL_REPLY_TO` | Where guest replies go. |
| `BOOKING_ALERT_TO` | Where new booking and enquiry alerts go. |
| `EMAIL_DEV_TO` | Comma-separated safe inbox(es). All staging email goes here instead of real recipients. **Required** on staging. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget key (public, build time). |
| `TURNSTILE_SECRET_KEY` | Turnstile server-side verification. |

Not needed on Netlify:

- `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` are only read by `npm run db:seed` (see step 5 below).
- `NODE_VERSION` is set in `netlify.toml`.
- `AUTH_URL` / `AUTH_TRUST_HOST`: the app already sets `trustHost: true` (`src/auth.config.ts`), so Auth.js uses the host Netlify forwards.

## Build

`netlify.toml` runs `npm run build:netlify`, which is `prisma generate && prisma migrate deploy && next build`. `migrate deploy` only applies migrations already committed in `prisma/migrations`. It never resets anything. If a migration fails, the build fails and the previous deploy stays live.

## Your steps

### 1. Neon (staging database)

1. Neon console → your project → **Branches** → **Create branch** (name it `staging`), or create a separate project if you prefer full isolation. Branch from an empty or schema-only parent, not from live guest data.
2. Open the new branch → **Connect**. Pick the right branch, database and role.
3. Copy the **pooled** connection string (the "Connection pooling" toggle on) → this is `DATABASE_URL`.
4. Switch the toggle off and copy the **direct** string → this is `DIRECT_URL`.

### 2. Cloudflare Turnstile

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Name: `Bagaicha staging`. Hostnames: `staging.bagaichaecoresort.com`. Widget mode: Managed.
3. Copy the **site key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and the **secret key** → `TURNSTILE_SECRET_KEY`.
4. Use a separate widget for staging so you can tighten or loosen it without touching production.

### 3. Netlify

1. **Add new project** → **Import an existing project** → GitHub → pick this repo.
2. Branch to deploy: the branch you want staging to follow (for example `staging`, or `main` if you want it to mirror main). Build command and publish directory should be picked up from `netlify.toml`; leave the publish directory to Netlify's Next.js default.
3. Before the first deploy: **Site configuration → Environment variables** → add every variable from the table above.
4. **Site configuration → Build & deploy → Branches and deploy contexts**: turn **Deploy Previews** off. Every context runs `prisma migrate deploy`, and previews would run migrations against the same staging database.
5. **Deploy**. Check the build log reaches `prisma migrate deploy` and then `next build`.
6. **Domain management → Add a domain** → `staging.bagaichaecoresort.com`. Netlify shows the DNS target it wants (a `CNAME` to your `*.netlify.app` address). Note it for step 4.
7. After DNS resolves, **HTTPS → Verify DNS configuration → Provision certificate** (Let's Encrypt).

### 4. Cloudflare DNS

1. Cloudflare → `bagaichaecoresort.com` → **DNS → Records → Add record**.
2. Type `CNAME`, Name `staging`, Target `<your-site>.netlify.app` (from Netlify step 6).
3. Set **Proxy status to "DNS only"** (grey cloud) at least until Netlify has issued the certificate. Cloudflare proxying in front of Netlify can break certificate provisioning; if you later want it proxied, set SSL/TLS mode to **Full (strict)**.
4. If you send email from this domain through Resend: Resend → **Domains** → add the domain, then add the DNS records it lists (SPF/DKIM, usually `TXT` and `MX`) in Cloudflare, with proxy off, and wait for **Verified**.

### 5. First data and first admin

The staging database starts empty (only the schema). Do this once, from your machine:

1. Temporarily point a **separate** env file or shell at the staging `DATABASE_URL`/`DIRECT_URL`, plus `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD`. Don't overwrite your normal `.env.local` values by accident, and don't run this against production.
2. `npm run db:seed` creates the first superuser. `npm run seed:content` and `npm run seed:inventory` load the content and inventory seeds.
3. Restore your local env afterwards.

### 6. Check it

1. Open `https://staging.bagaichaecoresort.com`: the browser should ask for the password; the page should show the "Test site — not live" strip and placeholder badges.
2. `/robots.txt` shows `Disallow: /`. `/sitemap.xml` is a 404. View source: `noindex` meta tag.
3. Submit a test booking request: the email arrives at your `EMAIL_DEV_TO` inbox(es) with `[DEV → …]` in the subject, and nothing goes to the guest address.
4. Log in at `/login` with the superuser.

## Open items before production

Production is a separate Netlify site with its own database: no `SITE_ENV`, no `STAGING_PASSWORD`, no `EMAIL_DEV_TO`, and every placeholder resolved (production hides placeholders instead of showing them).
