-- Seed: event_types + symbols
-- Idempotent — safe to re-run.

insert into symbols (ticker, asset_class, yf_symbol, display_name, tv_symbol, unit_label, pip_size) values
  ('SPY',      'etf', 'SPY',      'S&P 500 ETF',          'AMEX:SPY',         'percent', null),
  ('QQQ',      'etf', 'QQQ',      'Nasdaq 100 ETF',       'NASDAQ:QQQ',       'percent', null),
  ('EURUSD',   'fx',  'EURUSD=X', 'EUR / USD',            'FX:EURUSD',        'pips',    0.0001),
  ('GBPUSD',   'fx',  'GBPUSD=X', 'GBP / USD',            'FX:GBPUSD',        'pips',    0.0001),
  ('USDJPY',   'fx',  'USDJPY=X', 'USD / JPY',            'FX:USDJPY',        'pips',    0.01),
  ('AUDUSD',   'fx',  'AUDUSD=X', 'AUD / USD',            'FX:AUDUSD',        'pips',    0.0001)
on conflict (ticker) do nothing;

insert into event_types (slug, display_name, currency, country, category, default_impact, cadence, description) values
  ('us-cpi-yoy',             'US CPI YoY',                 'USD', 'US', 'inflation', 'high',   'monthly',       'Headline year-over-year consumer price inflation. Released by BLS, ~8:30 ET.'),
  ('us-core-cpi-yoy',        'US Core CPI YoY',            'USD', 'US', 'inflation', 'high',   'monthly',       'CPI ex food & energy. Same release as headline CPI.'),
  ('us-cpi-mom',             'US CPI MoM',                 'USD', 'US', 'inflation', 'high',   'monthly',       'Month-over-month change in CPI.'),
  ('us-pce-yoy',             'US Core PCE YoY',            'USD', 'US', 'inflation', 'high',   'monthly',       'Fed''s preferred inflation gauge.'),
  ('us-nfp',                 'US Non-Farm Payrolls',       'USD', 'US', 'employment','high',   'monthly',       'BLS jobs report — usually first Friday of the month, 8:30 ET.'),
  ('us-unemployment-rate',   'US Unemployment Rate',       'USD', 'US', 'employment','high',   'monthly',       'Released with NFP.'),
  ('us-jobless-claims',      'US Initial Jobless Claims',  'USD', 'US', 'employment','medium', 'weekly',        'Thursday 8:30 ET weekly read on layoffs.'),
  ('us-retail-sales-mom',    'US Retail Sales MoM',        'USD', 'US', 'consumer',  'medium', 'monthly',       'Census Bureau retail trade survey.'),
  ('us-ism-manufacturing',   'US ISM Manufacturing PMI',   'USD', 'US', 'sentiment', 'medium', 'monthly',       'First business day of month.'),
  ('us-ism-services',        'US ISM Services PMI',        'USD', 'US', 'sentiment', 'medium', 'monthly',       'Third business day of month.'),
  ('fomc-rate-decision',     'FOMC Rate Decision',         'USD', 'US', 'rates',     'high',   'fomc-schedule', 'Federal Reserve interest rate decision.'),
  ('fomc-powell-speech',     'FOMC Member Powell Speech',  'USD', 'US', 'rates',     'high',   'irregular',     'Chair Powell remarks — market-moving when discussing policy.'),
  ('ecb-rate-decision',      'ECB Interest Rate Decision', 'EUR', 'EU', 'rates',     'high',   'monthly',       'ECB Governing Council rate decision.'),
  ('ecb-press-conference',   'ECB Press Conference',       'EUR', 'EU', 'rates',     'high',   'monthly',       '45min after ECB rate decision.'),
  ('boe-rate-decision',      'BoE Interest Rate Decision', 'GBP', 'UK', 'rates',     'high',   'monthly',       'Bank of England MPC.'),
  ('boj-rate-decision',      'BoJ Interest Rate Decision', 'JPY', 'JP', 'rates',     'high',   'irregular',     'Bank of Japan policy meeting.'),
  ('boj-press-conference',   'BoJ Press Conference',       'JPY', 'JP', 'rates',     'high',   'irregular',     'Governor remarks after rate decision.'),
  ('uk-cpi-yoy',             'UK CPI YoY',                 'GBP', 'UK', 'inflation', 'high',   'monthly',       'ONS consumer price inflation.'),
  ('uk-gdp-qoq',             'UK GDP QoQ',                 'GBP', 'UK', 'growth',    'medium', 'quarterly',     'UK quarterly GDP.'),
  ('eu-cpi-yoy',             'Eurozone CPI YoY',           'EUR', 'EU', 'inflation', 'high',   'monthly',       'HICP flash + final.'),
  ('au-cash-rate',           'RBA Cash Rate',              'AUD', 'AU', 'rates',     'high',   'monthly',       'Reserve Bank of Australia.')
on conflict (slug) do nothing;
