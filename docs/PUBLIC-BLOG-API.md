# Public Blog API (`/api/public/v1`)

Read-only, key-authenticated HTTP API that hands the complete blog — all four
languages, full formatting, images, FAQ and metadata — to an external portal.

Built 2026-08-26. Source: `src/app/api/public/v1/`, `src/lib/publicApi/`.

- **Base URL** — `https://cyprusvipestates.com/api/public/v1`
- **Corpus** — 211 published articles (en 54 · de 55 · pl 51 · ru 51), linked
  across languages by `translationGroupId`. Drafts are never exported.
- **Format** — the article body arrives as pre-serialized HTML. The consumer
  supplies CSS, nothing else.

## Authentication

Send the key in either header:

```
X-API-Key: <secret>
Authorization: Bearer <secret>
```

Keys live in the `BLOG_API_KEYS` env var as comma-separated `<label>:<secret>`
pairs, e.g. `portal-two:9f3c…`. The label appears only in server logs and rate
limiting, so a leaked key can be traced to one consumer and revoked without
touching the others. Secrets shorter than 24 characters are ignored on load.

Revoking a consumer = delete its pair from `BLOG_API_KEYS` and restart. No code
change, no deploy of application code.

| Status | Body `error` | Cause |
| --- | --- | --- |
| 401 | `missing_api_key` | no key header sent |
| 401 | `invalid_api_key` | key not in `BLOG_API_KEYS` |
| 429 | `rate_limited` | >120 requests/minute for that key (`Retry-After: 60`) |
| 503 | `api_not_configured` | `BLOG_API_KEYS` unset on the deployment |

The rate limit is in-process and per instance — it exists to stop a runaway
sync loop, not as a security control.

## `GET /posts` — index

| Param | Default | Notes |
| --- | --- | --- |
| `lang` | all | `en` \| `de` \| `pl` \| `ru` |
| `since` | — | ISO-8601; returns only articles with `updatedAt >= since` |
| `page` | `1` | 1-based |
| `limit` | `50` | max `100` |

```json
{
  "posts": [ /* PostSummary */ ],
  "page": 1, "limit": 50, "total": 55, "hasMore": true,
  "syncedAt": "2026-08-26T09:12:44.108Z"
}
```

Ordered by `publishedAt` descending. Store `syncedAt` and pass it back as
`since` on the next run for a delta sync.

### PostSummary

```jsonc
{
  "id": "83efc2c6-…",
  "slug": "immobilienausrichtung-zypern",
  "lang": "de",
  "title": "…",
  "excerpt": "…",                       // may be null
  "publishedAt": "2026-08-24T11:54:00.000Z",
  "updatedAt": "2026-08-25T09:47:40.168Z",
  "readingTime": 7,                     // minutes; computed when not stored
  "canonicalUrl": "https://cyprusvipestates.com/de/blog/immobilienausrichtung-zypern",
  "category": { "title": "…", "slug": "…" },          // may be null
  "author": { "name": "…", "position": "…", "image": Image },
  "previewImage": Image,                              // may be null
  "seo": { "metaTitle": "…", "metaDescription": "…" },
  "translations": {
    "en": { "slug": "property-orientation-cyprus",
            "canonicalUrl": "https://cyprusvipestates.com/blog/property-orientation-cyprus" }
  }
}
```

`Image` is `{ url, width, height, alt, blurDataUrl }`. `url` is always absolute
and public; `blurDataUrl` is a base64 LQIP placeholder and may be null.

English is the default locale and carries **no** URL prefix — `/blog/x` for en,
`/de/blog/x` for the rest. `translations` never contains the article's own
language.

## `GET /posts/{slug}?lang=de` — one article

`lang` is required. Returns 404 `not_found` for an unknown or unpublished
article. Everything from PostSummary, plus:

```jsonc
{
  "html": "<p>…</p>\n<h2 id=\"…\">…</h2>…",
  "headings": [ { "id": "klima-und-lebensqualitat", "text": "…", "level": 2 } ],
  "images":   [ Image, … ],             // every image in the body, deduped
  "embeds":   [ Embed, … ],             // see below
  "faq":      [ { "question": "…", "answerHtml": "…", "answerText": "…" } ],
  "video":    { "provider": "youtube", "videoId": "…", "posterImage": Image },
  "authorBio": "…",
  "unsupportedBlockTypes": []
}
```

The response carries a weak `ETag` derived from `updatedAt`. Send it back as
`If-None-Match` and an unchanged article answers `304` with no payload.

`unsupportedBlockTypes` is empty across the whole current corpus. A non-empty
array means the CMS grew a block type this API has not been taught yet — the
block is skipped, and the server logs a warning.

### HTML contract

Only these tags are emitted, so a consumer stylesheet can cover them exhaustively:

- text — `p`, `h2`–`h6`, `blockquote`, `strong`, `em`, `u`, `s`, `code`
- lists — `ul`, `ol`, `li` (one level of nesting occurs)
- links — `a`
- images — `figure.cvp-figure > img` (absolute `src`, `width`/`height`, `loading="lazy"`)
- tables — `div.cvp-table-wrap > table.cvp-table > thead/tbody/tr/th/td`
- FAQ — `section.cvp-faq > details.cvp-faq__item > summary.cvp-faq__question` + `div.cvp-faq__answer`
- placeholders — `div.cvp-embed` (see below)

`h2`/`h3`/`h4` carry an `id` produced by the site's transliterating slugifier,
so Cyrillic headings get real anchors and `headings[].id` matches the markup.

Wrap `div.cvp-table-wrap` in `overflow-x: auto` — several articles have wide
comparison tables.

**Links.** Cross-references between articles are stored site-relative and go out
absolute (`https://cyprusvipestates.com/de/blog/…`) so they never 404 on a
foreign domain. Each carries `data-cvp-internal="/de/blog/…"` — if the consumer
has its own copy of that article, it can rewrite the `href` to its own URL.
External links get `target="_blank" rel="noopener nofollow"`.

### Embeds — what is deliberately *not* exported

Two block types are CVP-specific and carry no usable payload for a third party:
project listings pulled from our inventory, and our lead-capture forms. Both are
emitted as an **empty placeholder element**, in the position they occupy in the
article, and described in `embeds`. The consumer replaces the whole element with
its own equivalent. Placeholder ids and `embeds[].id` are in the same order.

```html
<div class="cvp-embed cvp-embed--projects" data-cvp-embed="projects"
     data-cvp-embed-id="embed-5" data-title="Villen in Paphos"
     data-criteria-source="inferred" data-city="Paphos"
     data-property-type="Villa" data-price-min="385000"
     data-price-max="1100000" data-limit="5"></div>

<div class="cvp-embed cvp-embed--lead-form" data-cvp-embed="lead-form"
     data-cvp-embed-id="embed-7" data-title="Form"
     data-button-text="Anfrage senden"></div>
```

```jsonc
// embeds[]
{ "id": "embed-5", "kind": "projects", "title": "Villen in Paphos",
  "criteriaSource": "filters" | "inferred" | "none",
  "criteria": { "city": "Paphos", "propertyType": "Villa",
                "priceMin": 385000, "priceMax": 1100000, "limit": 5 } }

{ "id": "embed-7", "kind": "lead-form", "title": "Form",
  "buttonText": "Anfrage senden" }
```

`criteriaSource` says how much to trust the criteria:

- `filters` — the editor set an explicit city/type/price filter. Honour it.
- `inferred` — the editor hand-picked individual projects. Those projects are
  **not** exported; instead their city, property type and price range are
  aggregated into criteria so the consumer can run the equivalent query against
  its own inventory. Approximate by construction.
- `none` — nothing to go on. Fall back to a generic "featured properties"
  selection, or drop the block.

Corpus-wide: 122 embeds across the 211 articles.

### Indexing — consuming pages carry `noindex`

These articles are published on cyprusvipestates.com first. A second indexable
copy competes with the original for the same rankings, in four languages, and
the damage is close to invisible from here: it shows up as unexplained
impression loss, with the cause on a domain we have no Search Console access to.

The agreed setup is therefore that consuming pages are excluded from search:

```html
<meta name="robots" content="noindex, follow">
```

**`noindex` and `rel="canonical"` pointing here must never appear on the same
page.** They are contradictory signals, and the `noindex` can end up applied to
the canonical target — which would deindex the original article on this site.
One mechanism or the other. `canonicalUrl` ships in every payload regardless and
is fine as a visible "originally published at" link.

Two related traps, both of which silently defeat the `noindex`: blocking the
URLs in the consumer's `robots.txt` (a page that is never crawled is never read,
and can still be indexed URL-only), and listing them in the consumer's sitemap
or hreflang cluster.

The full rules, written for the consumer, are in
`docs/PORTAL-BLOG-INTEGRATION-PROMPT.md`.

### The watchdog — `/api/cron/syndication-watch`

None of the above is enforceable from here: we send body HTML, the consumer
builds the page head. So we check their pages instead.

`SYNDICATION_WATCH_URLS` holds a comma-separated list of live article URLs on
the consuming portal — ask for 3–5, one per language, once its pages exist. The
job fetches each and classifies it:

| Verdict | Meaning | Alert |
| --- | --- | --- |
| `ok` | `noindex` present (meta or `X-Robots-Tag`), no conflicting canonical | — |
| `indexable` | No `noindex`, no canonical here — a competing copy | immediate |
| `conflicting` | `noindex` **and** a canonical pointing here — can deindex the original | immediate |
| `canonical-only` | No `noindex`, canonical points here — weaker than agreed | throttled |
| `unreachable` | Fetch failed, URL changed, portal down | throttled |
| `not-a-consumer` | A cyprusvipestates.com URL was configured by mistake | throttled |

Critical verdicts page immediately over Telegram; the rest are throttled to once
a day. Every run is written to `CronRunLog` under the job name
`syndication-watch`, and a manual run returns the alert text in the response
(`alert`) so you can see what would be sent without triggering a message.

Unset `SYNDICATION_WATCH_URLS` = the job reports `skipped` and does nothing, so
it can ship before the consuming portal exists.

```
# crontab on the VPS — daily 04:15 UTC
15 4 * * * curl -s "http://127.0.0.1:3000/api/cron/syndication-watch?key=$CRON_SECRET" >/dev/null
```

The job is not yet registered in the Action Center's cron-health list
(`src/lib/actionCenter/rules/system.ts`), so a silently missing cron would not
raise a stale-job item — worth adding when that file is next touched.

If a consumer ignores the rules, the lever is the API key: remove its pair from
`BLOG_API_KEYS` and restart. No deploy of application code needed.

## Examples

```bash
# index, German, changed since the last sync
curl -H "X-API-Key: $KEY" \
  "https://cyprusvipestates.com/api/public/v1/posts?lang=de&since=2026-08-01T00:00:00Z"

# one article
curl -H "X-API-Key: $KEY" \
  "https://cyprusvipestates.com/api/public/v1/posts/immobilienausrichtung-zypern?lang=de"
```

## Deployment

Set `BLOG_API_KEYS` in `.env.production` on the VPS and restart the app:

```
BLOG_API_KEYS="portal-two:<64-hex-secret>"
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Until the variable is set the endpoints answer `503 api_not_configured` — they
are inert, not open. `/api` is already disallowed in `robots.txt`.
