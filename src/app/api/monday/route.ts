// Compatibility alias for /api/leads. Kept deliberately, not because anything
// still talks to Monday.com — lead capture moved to Postgres + Telegram/email
// long ago, and as of 2026-09-26 every form in the repo posts to /api/leads
// directly.
//
// It stays because the old path is baked into HTML that is already out in the
// world: a page served before that change, sitting in a browser tab or a CDN
// cache, will still POST here when someone finally submits it. Deleting this
// file turns those submissions into a 404 — a lead lost with no trace anywhere.
// It costs one re-export to never find out how many that would have been.
export { POST } from "@/app/api/leads/route";
