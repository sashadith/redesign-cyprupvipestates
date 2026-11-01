import { isbot } from "isbot";

/* Second and third conditions for the Meta pixel, on top of the host guard
 * (trackingHost.ts) and the consent branch in [lang]/layout.tsx (2026-11-01).
 *
 * 1. An explicit switch. NEXT_PUBLIC_META_PIXEL_ENABLED is baked in at build
 *    time and set to "1" only in the production env file, so a testbed, the
 *    design subdomain or a laptop build cannot report even if one of them ever
 *    lands on an allowlisted hostname (a hosts-file entry, a tunnel). It also
 *    turns the pixel off for good with one line and a deploy.
 *
 * 2. No automated browsers. Meta's dataset showed PageView spikes at 17:00,
 *    18:00 and 13–14:00 Nicosia on 13, 19 and 22 October that never appeared
 *    in our own page_views — headless runs, not visitors. Headless Chrome,
 *    Playwright and Puppeteer set `navigator.webdriver`; isbot covers crawlers
 *    and headless user agents that render scripts. The user-agent rule our own
 *    analytics uses for bot fleets (Action Center) is an after-the-fact
 *    aggregate and cannot decide at page load, so it is not repeated here. */

export function metaPixelEnabled(flag: string | undefined = process.env.NEXT_PUBLIC_META_PIXEL_ENABLED): boolean {
  return flag === "1";
}

export function isAutomatedVisitor(nav: { webdriver?: boolean; userAgent?: string } | undefined): boolean {
  if (!nav) return true;
  if (nav.webdriver === true) return true;
  return isbot(nav.userAgent ?? "");
}
