-- Update breaking_headlines.source_name allowed values.
-- BLS feed returns 403 from common cloud egress IPs.
-- Reuters Agency endpoint discontinued / 404s in 2026.
-- WSJ Markets + Economy feeds added as tier-1 wire replacement.

alter table breaking_headlines
  drop constraint if exists breaking_headlines_source_name_check;

alter table breaking_headlines
  add constraint breaking_headlines_source_name_check
  check (source_name in ('fed', 'ecb', 'wsj', 'yahoo'));
