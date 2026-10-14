-- Data-only: no table or column is changed or dropped.
--
-- Activities now have one "Description" (the existing `overview` column). For each activity:
--   * the description becomes the real text of the old short line (`summary`) and `overview`;
--     when both are real they are joined by a space, unless one already contains the other, so
--     running this again (or on a database where the same change was already applied) never
--     combines text twice;
--   * with no real text, the kept text is a placeholder and stays flagged as "overview";
--   * placeholder flags for the retired fields are removed.
-- "Real" means non-empty, not starting with "Placeholder:", and not flagged as a placeholder.

WITH real AS (
  SELECT
    id,
    "placeholderFields" AS flags,
    CASE
      WHEN btrim(coalesce(summary, '')) <> ''
        AND summary NOT LIKE 'Placeholder:%'
        AND NOT ('summary' = ANY ("placeholderFields"))
      THEN btrim(summary)
    END AS s,
    CASE
      WHEN btrim(coalesce(overview, '')) <> ''
        AND overview NOT LIKE 'Placeholder:%'
        AND NOT ('overview' = ANY ("placeholderFields"))
      THEN btrim(overview)
    END AS o,
    overview,
    summary
  FROM activities
),
merged AS (
  SELECT
    id,
    flags,
    CASE
      WHEN s IS NOT NULL AND o IS NOT NULL THEN
        CASE
          WHEN position(s IN o) > 0 THEN o
          WHEN position(o IN s) > 0 THEN s
          ELSE s || ' ' || o
        END
      ELSE coalesce(s, o)
    END AS text,
    coalesce(NULLIF(overview, ''), NULLIF(summary, '')) AS fallback
  FROM real
),
final AS (
  SELECT
    id,
    flags,
    coalesce(text, fallback) AS description,
    (text IS NULL AND fallback IS NOT NULL) AS still_placeholder
  FROM merged
)
UPDATE activities a
SET
  overview = f.description,
  "placeholderFields" = ARRAY(
    SELECT x
    FROM unnest(f.flags) AS x
    WHERE x <> ALL (ARRAY['summary', 'duration', 'season', 'bestTime', 'bestFor', 'highlights', 'whatToExpect', 'howWeHelp', 'tip', 'overview'])
  ) || CASE WHEN f.still_placeholder THEN ARRAY['overview'] ELSE ARRAY[]::text[] END
FROM final f
WHERE a.id = f.id
  AND (
    a.overview IS DISTINCT FROM f.description
    OR a."placeholderFields" IS DISTINCT FROM (
      ARRAY(
        SELECT x
        FROM unnest(f.flags) AS x
        WHERE x <> ALL (ARRAY['summary', 'duration', 'season', 'bestTime', 'bestFor', 'highlights', 'whatToExpect', 'howWeHelp', 'tip', 'overview'])
      ) || CASE WHEN f.still_placeholder THEN ARRAY['overview'] ELSE ARRAY[]::text[] END
    )
  );
