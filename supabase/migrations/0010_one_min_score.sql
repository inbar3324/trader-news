-- Add 1-minute reaction score: how big is the first-minute spike vs the
-- symbol's normal 1-min noise. Anchored same way as vol_score (ratio × 2.5).
-- Idempotent.

alter table historical_reactions
  add column if not exists one_min_score int;
