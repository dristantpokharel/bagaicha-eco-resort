# Migration-test branch

Database tests that must not touch real data (`npm run test:db:reservations`) and the check of a new migration run against a throwaway Neon branch, configured in `.env.migration-test` (gitignored). Without that file they skip with a one-line message, and `npm test` never needs it.

## Recreate it for a new migration

1. In the Neon console, create a branch of the dev database (name it `migration-test`) so it has the same schema and a copy of the data. Never reuse the staging or production branch.
2. Create `.env.migration-test` in the repo root with that branch's `DATABASE_URL` (pooled) and `DIRECT_URL` (direct). Its host must differ from `.env.local`; the test helper and `scripts/with-test-db.mjs` refuse to run otherwise.
3. Apply the migrations to it: `node scripts/with-test-db.mjs npx prisma migrate deploy`. The script reads the file in Node and masks URLs in its output.
4. Run the tests: `npm run test:db:reservations`. The migration tests build their own temporary schema, so they are safe to re-run; the other tests tag and remove only their own rows.
5. When the migration has shipped, delete the branch and the file.
