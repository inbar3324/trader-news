export type ImpactLevel = "low" | "medium" | "high" | "holiday";
export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF" | "NZD";
export type UnitLabel = "percent" | "pips" | "points";

export interface EventType {
  id: string;
  slug: string;
  display_name: string;
  currency: CurrencyCode;
  country: string;
  category: string;
  default_impact: ImpactLevel;
  cadence: string | null;
  description: string | null;
}

export interface CalendarEvent {
  id: string;
  event_type_id: string | null;
  title: string;
  release_at: string;
  impact: ImpactLevel;
  currency: CurrencyCode;
  source: string;
  source_ref: string | null;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  event_type_slug: string | null;
}

export interface Symbol {
  ticker: string;
  asset_class: string;
  yf_symbol: string;
  display_name: string;
  tv_symbol: string;
  unit_label: UnitLabel;
  pip_size: number | null;
}

export type BreakingSource = "fed" | "ecb" | "wsj" | "yahoo";
export type BreakingCategory = "fed" | "macro" | "geo" | "corp" | "noise";
export type AiConfidence = "high" | "medium" | "low";

export interface BreakingHeadline {
  id: string;
  source_id: string;
  source_name: BreakingSource;
  headline: string;
  source_url: string | null;
  published_at: string;
  discovered_at: string;
  impact_score: number | null;
  category: BreakingCategory | null;
  classifier_reason: string | null;
  classified_at: string | null;
  summary: string | null;
  market_implication: string | null;
  affected_symbols: string[] | null;
  ai_confidence: AiConfidence | null;
  ai_verified: boolean | null;
  ai_enriched: boolean;
  ai_enriched_at: string | null;
}

export interface HistoricalReaction {
  event_type_id: string;
  symbol: string;
  sample_size: number;
  avg_abs_pct_1m:  number | null; median_abs_pct_1m:  number | null; max_abs_pct_1m:  number | null;
  avg_abs_pct_5m:  number | null; median_abs_pct_5m:  number | null; max_abs_pct_5m:  number | null;
  avg_abs_pct_15m: number | null; median_abs_pct_15m: number | null; max_abs_pct_15m: number | null;
  avg_abs_pct_60m: number | null; median_abs_pct_60m: number | null; max_abs_pct_60m: number | null;
  avg_abs_pts_1m:  number | null; median_abs_pts_1m:  number | null; max_abs_pts_1m:  number | null;
  avg_abs_pts_5m:  number | null; median_abs_pts_5m:  number | null; max_abs_pts_5m:  number | null;
  avg_abs_pts_15m: number | null; median_abs_pts_15m: number | null; max_abs_pts_15m: number | null;
  avg_abs_pts_60m: number | null; median_abs_pts_60m: number | null; max_abs_pts_60m: number | null;
  avg_vol_ratio_5m:  number | null; max_vol_ratio_5m:  number | null;
  avg_vol_ratio_15m: number | null; max_vol_ratio_15m: number | null;
  avg_vol_ratio_60m: number | null; max_vol_ratio_60m: number | null;
  avg_intraday_range_pct:    number | null;
  median_intraday_range_pct: number | null;
  max_intraday_range_pct:    number | null;
  avg_intraday_vol_ratio: number | null;
  max_intraday_vol_ratio: number | null;
  open_vol_score: number | null;
  one_min_score: number | null;
  directional_bias_up_pct: number | null;
  reversal_rate_15m: number | null;
  vol_score: number | null;
  last_computed_at: string;
}
