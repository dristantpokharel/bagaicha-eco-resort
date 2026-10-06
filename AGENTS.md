# AGENTS.md — Bagaicha Eco Resort

Read this file, `docs/spec.md` and (for any public-facing UI) `docs/design.md` before planning or coding.

## What we're building
Website + admin portal for **Bagaicha Eco Resort** (Khairi, Gulariya-3, Bardiya, Nepal).
Public site with booking requests, and an admin portal for bookings, rooms, photos, content and supply inventory.
No payments, no guest accounts, no add-on purchases.

## Stack (do not swap without asking)
- Next.js (latest stable, App Router) + TypeScript (strict) + Tailwind CSS
- Prisma ORM + Postgres on Neon (`DATABASE_URL` pooled, `DIRECT_URL` for migrations)
- Auth.js (NextAuth v5), email + password credentials, JWT sessions, roles in DB
- Cloudinary for all images (no images in `public/` except logo/favicon)
- Resend for email, Cloudflare Turnstile for form spam protection
- Hosting: Netlify
- Validation: Zod on every API route / server action input

## Hard rules
1. **Secrets:** read from `.env.local` only. Never print, log, echo or commit secret values. Never edit `.env*` files without asking.
2. **Database changes only through Prisma migrations** (`prisma migrate dev`). Never use `db push`. Never create tables by hand.
3. **Never run destructive commands without asking:** `migrate reset`, dropping tables, deleting files outside the task, `git push --force`.
4. **Every mutation is authorized.** Use the shared helpers in `src/lib/auth/` (`requireUser`, `requireRole`). No route or server action that changes data may skip them. Public endpoints are only: create booking request, create enquiry.
5. **Never invent content.** No made-up prices, distances, amenities, wildlife facts, policies, hours or reviews. If content is missing, use a clearly marked dev placeholder and list it in the phase walkthrough. No placeholder may ship to production.
6. **Single source of truth.** Business info, rooms, activities, etc. come from the database (or one config module). Never hardcode the same fact in multiple components.
7. **Dates:** check-in/check-out are date-only (`@db.Date`). "Today" is computed in `Asia/Kathmandu`.
8. **Money:** whole NPR as integers. Every booking stores its own price snapshot.
9. **Escape all user input** in emails and HTML.
10. **`_legacy/` is read-only reference** (the old site). You may read it and port logic deliberately. Never import from it, never copy Supabase code, never copy the old brand name.

## Working style
- One phase at a time (see `docs/spec.md` → Build phases). Plan first, wait for approval, then build.
- Small, focused commits with clear messages after each working step.
- Reuse components; one design-token system (Tailwind theme). No duplicated button/label styles.
- At the end of each phase: run typecheck, lint and build; test the main flows in the browser; write a short walkthrough listing what was done, what to test, and any open questions or placeholders.
- If something in the spec is unclear or contradictory, ask instead of guessing.