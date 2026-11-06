import { isbot } from "isbot";

// Which page-view beacons are not people (moved out of the track route
// 2026-11-05, when the user-agent test alone stopped being enough).

// Defense-in-depth on top of the maintained `isbot` pattern list: named crawlers we
// specifically care about catching (some already covered by isbot, kept explicit so a
// isbot version bump can't silently drop coverage we depend on) plus older headless-
// browser/Lighthouse self-identifications. Modern PageSpeed Insights' Lighthouse run
// does NOT reliably include any of these strings in its UA (confirmed empirically,
// 2026-07-20 — see the isPrefetch/backfill note in the track route for how that
// traffic is actually caught) — this list is for crawlers that DO self-identify honestly.
const EXTRA_BOT_RE =
  /googlebot|bingbot|ahrefsbot|semrushbot|gptbot|claudebot|perplexitybot|bytespider|facebookexternalhit|chrome-lighthouse|headlesschrome/i;

// Crawlers that DON'T self-identify: one frozen desktop-Chrome string, compared
// exactly. Measured over the 30 days to 2026-11-05 this Mac Chrome 145 UA (the
// current release was 156) was 60 % of the "US" and 97 % of the "SG" human views
// and 0 % in CY/DE/GB/PL/IL; 99 % of it never answered the cookie banner, at 1.1
// views per visitor. Exact match on purpose: a version-age rule would also catch
// real people on an outdated browser. The migration
// 20261105190100_pageview_frozen_chrome_fleet flagged the rows stored before.
const FLEET_USER_AGENTS = new Set([
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
]);

export function isBotUA(ua: string): boolean {
  if (!ua) return false;
  return FLEET_USER_AGENTS.has(ua) || isbot(ua) || EXTRA_BOT_RE.test(ua);
}

// Meta's own network (AS32934). Its link-preview and ad-review crawlers render
// landing pages with a plain Chrome UA, so the beacon fires from here; people
// who tap an ad in the Facebook/Instagram app reach us from their own ISP, not
// from these ranges. Seen in the access log on 2026-11-05 sending the fleet UA
// above from 2a03:2880::/32 and 57.141.0.0/16. The IP is never stored, so this
// only works at ingestion — there is nothing to backfill from.
const CRAWLER_V4: Array<[string, number]> = [
  ["31.13.24.0", 21],
  ["31.13.64.0", 18],
  ["57.141.0.0", 16],
  ["66.220.144.0", 20],
  ["69.63.176.0", 20],
  ["69.171.224.0", 19],
  ["173.252.64.0", 18],
];
const CRAWLER_V6_PREFIXES = ["2a03:2880:"]; // 2a03:2880::/32

function v4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isCrawlerIp(raw: string): boolean {
  const ip = raw.trim().toLowerCase().replace(/^::ffff:/, "");
  if (ip.includes(":")) return CRAWLER_V6_PREFIXES.some((p) => ip.startsWith(p));
  const n = v4ToInt(ip);
  if (n === null) return false;
  return CRAWLER_V4.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

export function isBotTraffic(ua: string, ip: string): boolean {
  return isBotUA(ua) || isCrawlerIp(ip);
}
