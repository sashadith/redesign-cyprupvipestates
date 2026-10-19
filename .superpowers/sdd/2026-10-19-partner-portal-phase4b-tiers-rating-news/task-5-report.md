# Task 5 report: partner news
- news.ts: unreadCount ignores nearly_sold_out (dated "now", would never clear); badgeText (9+).
- newsFlow.ts (pure): slim/revive JSON-safe cache shape, ratesById. newsStore.ts: unstable_cache(3600, tag partner-news) catalogue (inventoryChanges 30d + computeAvailability), per-request rates via myProjects; partnerNewsUnread failure-safe (0 on error).
- /news page (ACTIVE), NewsSeen client component + markNewsSeenAction (own partner, revalidatePath /news), nav item + badge in PortalShell, layout computes count. nav.news in en/de/pl/ru, CSS.
- Tests: src/lib/__tests__/partnerNewsFlow.test.ts. npm test 1529 pass; tsc 0; lint 0 errors (pre-existing warnings).
- Concerns: the cache is process-local-ish (Next data cache); the "nearly sold out" state is not counted unread by design; cache keyed without a deploy tag bust, so a shape change needs the -v1 key bumped. Nothing run against a DB.
