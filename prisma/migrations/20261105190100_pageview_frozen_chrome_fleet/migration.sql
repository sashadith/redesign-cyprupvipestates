-- Backfill (2026-11-05): a crawler fleet sending one frozen desktop-Chrome user
-- agent (Mac, Chrome 145, ten versions behind the current release) was counted
-- as human. Over the 30 days to 2026-11-05 it was 60 % of the "US" and 97 % of
-- the "SG" views, 0 % in CY/DE/GB/PL/IL; 99 % never answered the cookie banner,
-- 1.1 views per visitor, beacons from Meta (2a03:2880::/32, 57.141.0.0/16) and
-- Alibaba/Tencent cloud ranges. The tracker flags it at ingestion from now on
-- (src/lib/analytics/botTraffic.ts); this marks the rows already stored.
UPDATE "page_views"
SET "isBot" = true
WHERE NOT "isBot"
  AND "userAgent" = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
