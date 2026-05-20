-- Extend historical_reactions with two new metric families:
--   1. Post-release volume ratios (5/15/60-min vs symbol's normal avg)
--   2. Day-anchored 9:30–11 ET intraday range + volume + score
-- All columns nullable. Idempotent.

alter table historical_reactions
  -- post-release volume vs normal
  add column if not exists avg_vol_ratio_5m  numeric,
  add column if not exists avg_vol_ratio_15m numeric,
  add column if not exists avg_vol_ratio_60m numeric,
  add column if not exists max_vol_ratio_5m  numeric,
  add column if not exists max_vol_ratio_15m numeric,
  add column if not exists max_vol_ratio_60m numeric,
  -- 9:30–11 ET window (day-anchored, NOT release-anchored)
  add column if not exists avg_intraday_range_pct    numeric,
  add column if not exists median_intraday_range_pct numeric,
  add column if not exists max_intraday_range_pct    numeric,
  add column if not exists avg_intraday_vol_ratio    numeric,
  add column if not exists max_intraday_vol_ratio    numeric,
  add column if not exists open_vol_score            int;
