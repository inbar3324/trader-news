-- Allow arbitrary key labels in gemini_usage (was: writer / researcher).
-- After this migration, the `role` column stores the env-var suffix
-- (writer, researcher, 3, 4, ...) so a pool of N keys can be tracked.

alter table gemini_usage
  drop constraint if exists gemini_usage_role_check;

-- Keep the column NOT NULL but no enum restriction.
