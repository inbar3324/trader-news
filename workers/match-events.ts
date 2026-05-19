// Re-match existing events (event_type_id = NULL) against event_types.
// Also seeds the new event_types from 0007 migration via JS (idempotent).
// Run: npm --workspace workers run match-events

import { getServiceClient } from "./lib/supabase.js";
import { matchEventType, type EventTypeRow } from "./lib/event-type-matcher.js";

const NEW_EVENT_TYPES = [
  { slug: "fomc-meeting-minutes",              display_name: "FOMC Meeting Minutes",             currency: "USD", country: "US", category: "rates",     default_impact: "high",   cadence: "fomc-schedule", description: "Minutes from prior FOMC meeting — typically 3 weeks after rate decision." },
  { slug: "us-flash-manufacturing-pmi",        display_name: "US Flash Manufacturing PMI",       currency: "USD", country: "US", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "S&P Global flash manufacturing PMI — preliminary read." },
  { slug: "us-flash-services-pmi",             display_name: "US Flash Services PMI",            currency: "USD", country: "US", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "S&P Global flash services PMI — preliminary read." },
  { slug: "us-pending-home-sales-mom",         display_name: "US Pending Home Sales MoM",        currency: "USD", country: "US", category: "consumer",  default_impact: "medium", cadence: "monthly",       description: "NAR pending home sales index." },
  { slug: "us-philly-fed-manufacturing",       display_name: "US Philly Fed Manufacturing Index",currency: "USD", country: "US", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "Federal Reserve Bank of Philadelphia regional manufacturing survey." },
  { slug: "us-uom-consumer-sentiment-revised", display_name: "US Revised UoM Consumer Sentiment",currency: "USD", country: "US", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "Final University of Michigan consumer sentiment." },
  { slug: "uk-claimant-count-change",          display_name: "UK Claimant Count Change",         currency: "GBP", country: "UK", category: "employment",default_impact: "high",   cadence: "monthly",       description: "Change in unemployment-benefit claimants." },
  { slug: "uk-flash-manufacturing-pmi",        display_name: "UK Flash Manufacturing PMI",       currency: "GBP", country: "UK", category: "sentiment", default_impact: "high",   cadence: "monthly",       description: "S&P Global / CIPS flash manufacturing PMI." },
  { slug: "uk-flash-services-pmi",             display_name: "UK Flash Services PMI",            currency: "GBP", country: "UK", category: "sentiment", default_impact: "high",   cadence: "monthly",       description: "S&P Global / CIPS flash services PMI." },
  { slug: "uk-average-earnings-index-3m",      display_name: "UK Average Earnings Index 3m/y",   currency: "GBP", country: "UK", category: "employment",default_impact: "medium", cadence: "monthly",       description: "ONS 3-month average earnings growth YoY." },
  { slug: "uk-retail-sales-mom",               display_name: "UK Retail Sales MoM",              currency: "GBP", country: "UK", category: "consumer",  default_impact: "medium", cadence: "monthly",       description: "ONS retail sales month-over-month." },
  { slug: "de-flash-manufacturing-pmi",        display_name: "German Flash Manufacturing PMI",   currency: "EUR", country: "DE", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "HCOB / S&P Global Germany flash manufacturing PMI." },
  { slug: "de-flash-services-pmi",             display_name: "German Flash Services PMI",        currency: "EUR", country: "DE", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "HCOB / S&P Global Germany flash services PMI." },
  { slug: "fr-flash-manufacturing-pmi",        display_name: "French Flash Manufacturing PMI",   currency: "EUR", country: "FR", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "HCOB / S&P Global France flash manufacturing PMI." },
  { slug: "fr-flash-services-pmi",             display_name: "French Flash Services PMI",        currency: "EUR", country: "FR", category: "sentiment", default_impact: "medium", cadence: "monthly",       description: "HCOB / S&P Global France flash services PMI." },
  { slug: "ca-cpi-mom",                        display_name: "CA CPI MoM",                       currency: "CAD", country: "CA", category: "inflation", default_impact: "high",   cadence: "monthly",       description: "StatsCan headline CPI month-over-month." },
  { slug: "ca-common-cpi-yoy",                 display_name: "CA Common CPI YoY",                currency: "CAD", country: "CA", category: "inflation", default_impact: "medium", cadence: "monthly",       description: "BoC common-component CPI." },
  { slug: "ca-median-cpi-yoy",                 display_name: "CA Median CPI YoY",                currency: "CAD", country: "CA", category: "inflation", default_impact: "medium", cadence: "monthly",       description: "BoC median CPI core measure." },
  { slug: "ca-trimmed-cpi-yoy",                display_name: "CA Trimmed CPI YoY",               currency: "CAD", country: "CA", category: "inflation", default_impact: "medium", cadence: "monthly",       description: "BoC trimmed-mean CPI core measure." },
  { slug: "ca-retail-sales-mom",               display_name: "CA Retail Sales MoM",              currency: "CAD", country: "CA", category: "consumer",  default_impact: "medium", cadence: "monthly",       description: "StatsCan retail sales." },
  { slug: "ca-core-retail-sales-mom",          display_name: "CA Core Retail Sales MoM",         currency: "CAD", country: "CA", category: "consumer",  default_impact: "medium", cadence: "monthly",       description: "StatsCan retail sales ex autos." },
  { slug: "au-employment-change",              display_name: "AU Employment Change",             currency: "AUD", country: "AU", category: "employment",default_impact: "high",   cadence: "monthly",       description: "ABS labour force survey monthly employment change." },
  { slug: "au-unemployment-rate",              display_name: "AU Unemployment Rate",             currency: "AUD", country: "AU", category: "employment",default_impact: "high",   cadence: "monthly",       description: "ABS labour force unemployment rate." },
] as const;

async function main() {
  const sb = getServiceClient();

  // 1. Seed new event_types (idempotent)
  const { error: seedErr } = await sb
    .from("event_types")
    .upsert(NEW_EVENT_TYPES.map((t) => ({ ...t })), { onConflict: "slug", ignoreDuplicates: true });
  if (seedErr) throw seedErr;
  console.log(`[match-events] seeded ${NEW_EVENT_TYPES.length} new event_types (upsert) ✓`);

  // 2. Load all event_types for matching
  const { data: typesData, error: typesErr } = await sb
    .from("event_types")
    .select("id, slug, display_name, currency");
  if (typesErr) throw typesErr;
  const types = (typesData ?? []) as EventTypeRow[];
  console.log(`[match-events] loaded ${types.length} event_types total`);

  // 3. Load all events with null event_type_id
  const { data: evData, error: evErr } = await sb
    .from("events")
    .select("id, title, currency, impact")
    .is("event_type_id", null);
  if (evErr) throw evErr;
  const events = evData ?? [];
  console.log(`[match-events] ${events.length} events with null event_type_id`);

  if (events.length === 0) {
    console.log("[match-events] nothing to do ✓");
    return;
  }

  // 4. Match and batch-update
  let matched = 0;
  let unmatched = 0;
  const updates: { id: string; event_type_id: string }[] = [];

  for (const ev of events) {
    const type = matchEventType(ev.title as string, ev.currency as string, types);
    if (type) {
      updates.push({ id: ev.id as string, event_type_id: type.id });
      matched++;
    } else {
      unmatched++;
    }
  }

  // Batch-update in chunks of 50
  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    for (const u of chunk) {
      const { error } = await sb
        .from("events")
        .update({ event_type_id: u.event_type_id })
        .eq("id", u.id);
      if (error) {
        console.error(`[match-events] failed to update event ${u.id}:`, error.message);
      }
    }
  }

  console.log(`[match-events] matched: ${matched}, unmatched: ${unmatched} ✓`);

  // 5. Log remaining unmatched high/medium titles for visibility
  if (unmatched > 0) {
    const unmatchedTitles = events
      .filter((ev) => !updates.some((u) => u.id === ev.id))
      .filter((ev) => ev.impact === "high" || ev.impact === "medium")
      .map((ev) => `  [${ev.currency}] ${ev.impact} — ${ev.title}`);
    if (unmatchedTitles.length > 0) {
      console.log("[match-events] still unmatched high/medium:");
      unmatchedTitles.slice(0, 20).forEach((l) => console.log(l));
    }
  }
}

main().catch((err) => {
  console.error("[match-events] FAILED:", err);
  process.exit(1);
});
