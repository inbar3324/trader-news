-- Additional event_types covering high/medium-impact FF feed titles observed
-- in production but missing from the initial 0002 seed.
-- Idempotent (on conflict do nothing).

insert into event_types (slug, display_name, currency, country, category, default_impact, cadence, description) values
  -- USD
  ('fomc-meeting-minutes',              'FOMC Meeting Minutes',             'USD','US','rates',    'high',  'fomc-schedule','Minutes from prior FOMC meeting — typically 3 weeks after rate decision.'),
  ('us-flash-manufacturing-pmi',        'US Flash Manufacturing PMI',       'USD','US','sentiment','medium','monthly',      'S&P Global flash manufacturing PMI — preliminary read.'),
  ('us-flash-services-pmi',             'US Flash Services PMI',            'USD','US','sentiment','medium','monthly',      'S&P Global flash services PMI — preliminary read.'),
  ('us-pending-home-sales-mom',         'US Pending Home Sales MoM',        'USD','US','consumer', 'medium','monthly',      'NAR pending home sales index.'),
  ('us-philly-fed-manufacturing',       'US Philly Fed Manufacturing Index','USD','US','sentiment','medium','monthly',      'Federal Reserve Bank of Philadelphia regional manufacturing survey.'),
  ('us-uom-consumer-sentiment-revised', 'US Revised UoM Consumer Sentiment','USD','US','sentiment','medium','monthly',      'Final University of Michigan consumer sentiment (revises preliminary).'),

  -- GBP
  ('uk-claimant-count-change',          'UK Claimant Count Change',         'GBP','UK','employment','high',  'monthly',     'Change in unemployment-benefit claimants — released with Average Earnings.'),
  ('uk-flash-manufacturing-pmi',        'UK Flash Manufacturing PMI',       'GBP','UK','sentiment', 'high',  'monthly',     'S&P Global / CIPS flash manufacturing PMI.'),
  ('uk-flash-services-pmi',             'UK Flash Services PMI',            'GBP','UK','sentiment', 'high',  'monthly',     'S&P Global / CIPS flash services PMI.'),
  ('uk-average-earnings-index-3m',      'UK Average Earnings Index 3m/y',   'GBP','UK','employment','medium','monthly',     'ONS 3-month average earnings growth YoY.'),
  ('uk-retail-sales-mom',               'UK Retail Sales MoM',              'GBP','UK','consumer',  'medium','monthly',     'ONS retail sales month-over-month.'),

  -- EUR (sub-region)
  ('de-flash-manufacturing-pmi',        'German Flash Manufacturing PMI',   'EUR','DE','sentiment','medium','monthly',      'HCOB / S&P Global Germany flash manufacturing PMI.'),
  ('de-flash-services-pmi',             'German Flash Services PMI',        'EUR','DE','sentiment','medium','monthly',      'HCOB / S&P Global Germany flash services PMI.'),
  ('fr-flash-manufacturing-pmi',        'French Flash Manufacturing PMI',   'EUR','FR','sentiment','medium','monthly',      'HCOB / S&P Global France flash manufacturing PMI.'),
  ('fr-flash-services-pmi',             'French Flash Services PMI',        'EUR','FR','sentiment','medium','monthly',      'HCOB / S&P Global France flash services PMI.'),

  -- CAD
  ('ca-cpi-mom',                        'CA CPI MoM',                       'CAD','CA','inflation','high',  'monthly',      'StatsCan headline CPI month-over-month.'),
  ('ca-common-cpi-yoy',                 'CA Common CPI YoY',                'CAD','CA','inflation','medium','monthly',      'BoC common-component CPI — preferred core measure.'),
  ('ca-median-cpi-yoy',                 'CA Median CPI YoY',                'CAD','CA','inflation','medium','monthly',      'BoC median CPI core measure.'),
  ('ca-trimmed-cpi-yoy',                'CA Trimmed CPI YoY',               'CAD','CA','inflation','medium','monthly',      'BoC trimmed-mean CPI core measure.'),
  ('ca-retail-sales-mom',               'CA Retail Sales MoM',              'CAD','CA','consumer', 'medium','monthly',      'StatsCan retail sales.'),
  ('ca-core-retail-sales-mom',          'CA Core Retail Sales MoM',         'CAD','CA','consumer', 'medium','monthly',      'StatsCan retail sales ex autos.'),

  -- AUD
  ('au-employment-change',              'AU Employment Change',             'AUD','AU','employment','high',  'monthly',     'ABS labour force survey monthly employment change.'),
  ('au-unemployment-rate',              'AU Unemployment Rate',             'AUD','AU','employment','high',  'monthly',     'ABS labour force unemployment rate.')
on conflict (slug) do nothing;
