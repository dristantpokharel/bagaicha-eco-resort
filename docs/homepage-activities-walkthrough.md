# Homepage Activities walkthrough

## What changed

- Content → Activities now has “Show on homepage” and “Homepage order” fields. Unselected activities stay off the homepage.
- The homepage Experiences band selects up to four active, non-placeholder activities from any Explore group, ordered by the homepage order. The band hides when there are no selected activities.
- `/explore` continues to show active activities grouped as before.
- The additive migration sets the homepage flag on existing “At Bagaicha” activities and copies their existing display order.

## What to test

1. In Content → Activities, select activities from different groups and set their homepage order.
2. Confirm the homepage shows only selected activities, in order, up to four. Clear all selections and confirm the band disappears.
3. Confirm `/explore` still groups activities and hides empty groups.

## Migration

The migration has not been applied. Dry-run it with:

```sh
npm run db:dryrun-migration -- prisma/migrations/20261124000000_activity_homepage_selection/migration.sql
```

No new content or placeholders were added.
