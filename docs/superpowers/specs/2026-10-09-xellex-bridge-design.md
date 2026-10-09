# Xellex Bridge — Design

**Date:** 2026-10-09 · **Status:** approved in chat, spec pending user review
**Goal:** A read-only HTTP API on CVE that delivers published developments — all fields, all units, all images — to Xellex, with a per-developer switch controlling which of them is delivered at all.

## Context

Xellex is the operator's own second public portal: its own domain and audience, showing the same properties under a different brand. It keeps its own database and syncs periodically; it downloads and re-hosts the images rather than linking back to CVE. It receives the full payload including CVE's four-language copy, and decides for itself whether to rewrite it.

The operator was shown the duplicate-content consequence and accepted it: CVE's project pages currently rank **only** on development names (77 queries in Cyprus, 2 in Germany, measured 2026-09-16), and a second site publishing the same text under the same names means Google shows one of the two. The `rel=canonical` decision therefore lives on Xellex's side, not in this API.

**Measured on production, 2026-10-09** — these numbers size every decision below:

| | |
|---|---|
| published developments | 344 |
| developer accounts with published work | 24 of 25 |
| unit rows under them | 4,872 |
| `/uploads/` image references | 46,423 (~135 per project) |
| full payload, raw JSON | 18.6 MB (~3 MB gzipped) |
| largest single project | 370 KB |
| mirrored image store on disk | 11 GB, 97,433 files, 432 folders |
| CVE's own data refresh | feed-sync 04:00, drive-sync 04:30, publish-scheduled every 5 min |

## What was verified before this spec

- **No outbound feed exists.** Everything under `src/app/api` either pulls data in (cron, feed-sync) or serves the admin. This is a new surface, not a change to an existing one.
- **`Development`, `DevelopmentOverride` and `DevelopmentUnit` each carry `updatedAt @updatedAt`** — the cursor exists in all three places it is needed.
- **There is no settings/config table** in the schema, so the per-developer switch needs somewhere to live.
- **Mirrored filenames are NOT content-addressed.** `imageMirror.ts` names files `<hash>_<size>.webp` where `hash` is `sha1(sourceUrl).slice(0,16)` — derived from the *source URL*, not the bytes. A developer who replaces a photo at the same URL produces the same filename with different content. The filename alone therefore cannot serve as the change signal.

## Contract

One endpoint, two modes:

```
GET /api/bridge/projects
GET /api/bridge/projects?updatedSince=<iso8601>[&cursor=<opaque>]
```

```jsonc
{
  "generatedAt": "2026-10-09T11:00:00.000Z",
  "complete": true,
  "cursor": null,
  "projects": [ /* … */ ],
  "removed": ["b3c1…", "9af2…"]
}
```

**`generatedAt` is the server's time, and Xellex passes it back as the next `updatedSince`.** Letting the client supply its own clock loses any change that lands between the query and the client's idea of "now", and the two clocks need not agree.

**`complete: false` means keep going** with the returned `cursor` until it is `true`. Pagination is not a response-size concern — 3 MB gzipped is one ordinary response — it is a latency and memory concern: the largest single project is 370 KB, and assembling all 344 with their units and 46,423 `stat` calls in one request would hold a connection open far too long. **Page size: 50 projects.**

`removed` is only meaningful alongside `updatedSince`. On a full export it is empty: everything absent is removed, by definition.

### Per-project payload

The published record as a reader of the page would know it: name and alias, category, status, stage, completion, energy rating, district/town/area, price range and currency, coordinates, unit counts, the four-language descriptions and SEO overrides from `DevelopmentOverride`, amenities, distances, extra facts, gallery and plans, developer label, and every `DevelopmentUnit` with its ~24 fields.

**Explicitly NOT delivered, by allowlist rather than by omission.** "Everything on the row" was the first draft of this section and it was wrong: `Development` carries operational plumbing that has no business on a second portal, and one item of it is a credential.

| withheld | why |
|---|---|
| `driveFolderId`, `driveImagesModified` | **A Drive folder id IS an access token here** — those folders are shared by anonymous link (see the Drive and Korantina connectors). Exporting it hands out read access to a developer's source folder. |
| `developerAccountId`, `dev`, `feedProjectId` | internal source identity; says which vendor pipeline a project came from |
| `syncedAt`, `imageDriftDetectedAt`, `newFromFeed` | sync bookkeeping, meaningless outside CVE |
| `presentationItems`, `supersedesProjects` | CRM and migration relations, unrelated to listing a property |

`feedKey` is withheld for the same reason as `dev`: it is literally `<vendor>:<id>`. `slug`, `slugHistory`, `soldOutSince` and `returnedToMarketAt` **are** delivered — Xellex needs the slug for its own URLs, the history to set up its own redirects, and the sold-out dates to decide what to show.

An allowlist also fails safe in the other direction: a column added to `Development` next year is withheld until someone decides it should travel, rather than appearing on a public portal the week it is created.

**The stable key is `Development.id` (UUID).** Not the slug, which changes when a project is renamed; not `feedKey`, which changes when a project moves to a different source and is withheld anyway. The slug travels as an ordinary field so Xellex can build its own URLs; identity and the `removed` list use the UUID.

### Images

Every image, all three mirrored variants, each with an absolute URL and a fingerprint:

```jsonc
{
  "role": "gallery",
  "variants": {
    "large": {
      "url": "https://cyprusvipestates.com/uploads/developments/inex/a3f8…_large.webp",
      "bytes": 184230,
      "modified": "2026-09-14T08:21:11.000Z"
    }
  }
}
```

`bytes` + `modified` come from `fs.stat` and exist because the filename does not change when content does (see above). Cost: one `stat` per file — ~46,000 on a full export, spread over seven pages; a handful on an incremental call. A content hash would be stronger and is deliberately not built: hashing 11 GB per export is not affordable, and storing a hash at mirror time is a change to the mirroring path, which this feature has no other reason to touch.

## Configuration, and the removal signal

Two columns on `DeveloperAccount`, no new table:

- **`bridgeEnabled Boolean @default(false)`** — the switch. Default off: a new developer account is not silently published to a second portal.
- **`bridgeChangedAt DateTime?`** — stamped on every toggle.

An admin screen lists the 24 developers with their published-project and unit counts and a switch each.

### The cursor spans three tables, plus the switch

A unit price changing does not touch the `Development` row. The incremental query therefore selects developments where `publishStatus = "published"`, the developer is enabled, **and** any of `Development.updatedAt`, `DevelopmentOverride.updatedAt` or `DevelopmentUnit.updatedAt` is newer than `updatedSince`.

**A fourth condition: or the developer's own `bridgeChangedAt` is newer.** Switching a developer **on** is exactly as invisible as switching it off — its projects' rows do not change, so none of the three timestamps moves, and an incremental consumer would never learn they became deliverable. They would surface only on a full export, which this design discourages.

This was missed in the first draft of the spec, which named only the off direction. It is the same bug `bridgeChangedAt` exists to prevent, pointing the other way: the stamp means *"the switch was last touched at T"*, and both the inclusion query and the removal query read it.

### `removed` has two sources, and the second is the one that gets forgotten

1. Projects whose row changed after `since` and which are no longer deliverable — depublished, archived.
2. **Every project of a developer whose `bridgeChangedAt` is after `since` and whose `bridgeEnabled` is now false.**

Without (2), switching a developer off changes nothing on its project rows, their `updatedAt` stays old, no incremental call ever mentions them, and they stay live on Xellex forever. This is the failure that would surface months later as "why are these still online" — it is the reason `bridgeChangedAt` exists at all.

## Access and operation

Header `x-api-key`, checked against `XELLEX_API_KEY` from the environment — the same shape CVE already uses to consume the INEX and BBF feeds (`DEV_FEED_KEY_*`). Read-only; the route has no write path. Rotation means an env change and a deploy, which is acceptable for a single consumer.

Each call appends a log row: timestamp, mode (full/incremental), project count, duration. Without it there is no way to tell whether Xellex is actually syncing or has quietly stopped.

## Non-goals

No push, no webhooks — CVE's data changes once a day at 04:00, and delivery guarantees, retries and a queue are not worth building for that. No write path back from Xellex. No content other than developments: no blog, no landing pages, no case studies. No drafts: `publishStatus = "published"` only.

## Risks named

- **Duplicate content is accepted, not solved.** Two public sites carrying the same four-language copy for the same development names. The operator decided this knowingly; the canonical choice is Xellex's.
- **`bytes` + `modified` is weaker than a content hash.** A file rewritten with identical size in the same second would not be detected. Practically irrelevant for photo re-uploads, and stated here rather than left implied.
- **The `stat` cost grows with the catalogue.** 46,423 today across seven pages. If the image count doubles, page size should fall rather than the latency rising.
- **A full export is 3 MB gzipped and will grow.** Xellex should use `updatedSince` after its first sync; nothing enforces that, and a client that re-downloads everything hourly would be wasteful but not harmful.
