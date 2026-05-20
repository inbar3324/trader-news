-- Add index/commodity futures to symbols.
-- All use unit_label='points', pip_size=1 (reaction-engine treats raw price diff as points).
-- yf_symbol uses continuous front-month (=F suffix); tv_symbol uses TradingView's
-- continuous-contract notation (e.g. CME_MINI:ES1!).
-- Idempotent.
insert into symbols (ticker, asset_class, yf_symbol, display_name, tv_symbol, unit_label, pip_size) values
  ('ES', 'futures', 'ES=F', 'E-mini S&P 500',  'CME_MINI:ES1!', 'points', 1),
  ('NQ', 'futures', 'NQ=F', 'E-mini Nasdaq',   'CME_MINI:NQ1!', 'points', 1),
  ('CL', 'futures', 'CL=F', 'WTI Crude Oil',   'NYMEX:CL1!',    'points', 1),
  ('GC', 'futures', 'GC=F', 'Gold',            'COMEX:GC1!',    'points', 1)
on conflict (ticker) do nothing;
