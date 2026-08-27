# Hand-off prompt — blog integration on the second portal

Paste everything below the line into Claude Code **in the second portal's
repository**. Before pasting, replace `<PORTAL_DOMAIN>` and put the real API key
into that project's env file yourself (it is a secret — do not paste it into a
chat message).

---

## Task: syndicate the Cyprus VIP Estates blog into this portal

You are integrating an external blog into this project over a read-only HTTP
API. The articles are authored in another CMS; this portal renders a synced
copy. Four languages, full formatting, images, FAQ blocks and metadata all come
over the wire.

Work in this order: (1) explore this codebase and confirm the local
equivalents named below, (2) build the sync layer, (3) build the rendering,
(4) do the embed adoption in Task C — that one is the substance of this job,
not an afterthought. Verify with real API responses, not mocks.

### The API

- Base URL: `https://cyprusvipestates.com/api/public/v1`
- Auth header on every request: `X-API-Key: <key>` (read it from an env var,
  e.g. `CVP_BLOG_API_KEY` — never hard-code it, never commit it)
- **Call this API from the server only.** The key authenticates a consumer, not
  an end user. A browser-side `fetch` would ship it to every visitor in plain
  text. All API traffic belongs in the sync job / server-side rendering path;
  nothing in the client bundle may reference the key or the API host.
- Rate limit: 120 requests/minute per key. Pace bulk syncs accordingly
  (~600 ms between requests is safe); a 429 carries `Retry-After: 60`.
- Corpus size: 211 published articles — en 54, de 55, pl 51, ru 51.

**`GET /posts?lang=de&since=<ISO>&page=1&limit=50`** → index

```jsonc
{ "posts": [PostSummary], "page": 1, "limit": 50, "total": 55,
  "hasMore": true, "syncedAt": "2026-08-26T09:12:44.108Z" }
```

`lang` (`en|de|pl|ru`) and `since` are optional; `limit` maxes out at 100.
Persist `syncedAt` and send it back as `since` next run for a delta sync.

**`GET /posts/<slug>?lang=de`** → one full article. `lang` is required.
Responds with a weak `ETag`; send it as `If-None-Match` and an unchanged
article answers `304` with no body. Use this — it is what makes a scheduled
re-sync cheap.

```jsonc
{
  "id": "83efc2c6-…", "slug": "…", "lang": "de",
  "title": "…", "excerpt": "…|null",
  "publishedAt": "2026-08-24T11:54:00.000Z",
  "updatedAt":   "2026-08-25T09:47:40.168Z",
  "readingTime": 7,
  "canonicalUrl": "https://cyprusvipestates.com/de/blog/…",
  "category": { "title": "…", "slug": "…" } | null,
  "author":   { "name": "…", "position": "…|null", "image": Image|null } | null,
  "authorBio": "…|null",
  "previewImage": Image|null,
  "seo": { "metaTitle": "…|null", "metaDescription": "…|null" },
  "translations": { "en": { "slug": "…", "canonicalUrl": "…" }, … },
  "html": "<p>…</p>\n<h2 id=\"…\">…</h2>…",
  "headings": [ { "id": "…", "text": "…", "level": 2 } ],
  "images":   [ Image, … ],
  "embeds":   [ Embed, … ],
  "faq":      [ { "question": "…", "answerHtml": "…", "answerText": "…" } ],
  "video":    { "provider": "youtube", "videoId": "…", "posterImage": Image|null } | null,
  "unsupportedBlockTypes": []
}
```

`Image` = `{ url, width, height, alt, blurDataUrl }`. `url` is absolute and
public; `blurDataUrl` is a base64 LQIP placeholder that may be null. Use
`width`/`height` to reserve layout space — the corpus has 191 body images and
unsized images will wreck CLS.

Error shapes: `401 {"error":"missing_api_key"|"invalid_api_key"}`,
`404 {"error":"not_found"}`, `429 {"error":"rate_limited"}`,
`503 {"error":"api_not_configured"}`.

### Task A — sync layer

Build a scheduled, resumable sync. Decide storage based on what this project
already uses (a table, a content collection, files on disk — follow the local
convention, do not introduce a new persistence mechanism for this alone).

Requirements:

- Walk `/posts` per language with pagination until `hasMore` is false.
- Fetch each article's detail; store the `ETag` and send `If-None-Match` on
  later runs so unchanged articles cost one 304.
- Persist `updatedAt` and the last successful `syncedAt`; the next run passes
  it as `since`. A first run with no stored value is a full sync.
- Idempotent: identify articles by `(lang, slug)` — that pair is unique and
  stable. `id` is stable too and is the better primary key if you have one.
- Articles that disappear from the index have been unpublished. Do not delete
  the local row silently; mark it unpublished and stop serving it, so the URL
  can 410/redirect rather than 404 into nothing.
- Log the counts (created / updated / unchanged / failed) per run. A failed
  article must not abort the whole run.
- If `unsupportedBlockTypes` is ever non-empty, log it loudly. It means the
  upstream CMS grew a block type the API does not serialize yet, and the
  article is rendering with a hole in it.

### Task B — rendering

- `html` is trusted, server-generated markup from a known source. Render it as
  HTML. If this project's framework requires explicit opt-in (`dangerouslySet
  InnerHTML`, `v-html`, `{@html}`, `|safe`), use it here and comment why.
- Tags that actually appear, and nothing else: `p`, `h2`–`h6`, `blockquote`,
  `strong`, `em`, `u`, `s`, `code`, `ul`, `ol`, `li`, `a`,
  `figure.cvp-figure > img`, `div.cvp-table-wrap > table.cvp-table`
  (`thead`/`tbody`/`tr`/`th`/`td`), `section.cvp-faq > details.cvp-faq__item`
  (`summary.cvp-faq__question`, `div.cvp-faq__answer`), and
  `div.cvp-embed` (Task C). Write CSS covering exactly this set, in this
  portal's own design language — do not try to look like the source site.
- `div.cvp-table-wrap` must get `overflow-x: auto`; several articles have wide
  comparison tables that will otherwise blow out the page on mobile.
- `h2`/`h3`/`h4` carry `id`s that match `headings[]`. Build the table of
  contents from `headings`, not by re-parsing the HTML.
- Build the article's `<title>`/meta description from `seo.metaTitle` /
  `seo.metaDescription`, falling back to `title` / `excerpt`.
- Emit FAQPage JSON-LD from `faq[]` when it is non-empty (844 entries exist
  across the corpus, so most articles have one).
- `video` is a YouTube id — embed with this portal's existing video component
  if one exists, lazily (facade/poster first), using `posterImage`.
- Internal cross-links arrive absolute, pointing back to the source site, and
  carry `data-cvp-internal="/de/blog/<slug>"`. After rendering, rewrite any
  such link whose target slug also exists in this portal's synced set to the
  local URL. Leave the rest pointing at the source — they are valid links.

### SEO — mandatory, not a nice-to-have

Every article page on this portal **must** emit:

```html
<link rel="canonical" href="{canonicalUrl}">
```

using the `canonicalUrl` from the payload, which points at the original on
cyprusvipestates.com. These articles are published there first; two indexable
copies without a canonical is duplicate content across four languages and the
two copies will cannibalise each other in search. If a stakeholder wants these
pages to rank on `<PORTAL_DOMAIN>` instead, that is a content decision to be
made deliberately — do not resolve it by quietly dropping the canonical. The
only acceptable alternative is `noindex` on the synced pages.

Also: build `hreflang` alternates from `translations` (plus the article's own
language). Note that on the source site English has no URL prefix while
`de`/`pl`/`ru` do — mirror whatever convention *this* portal already uses, and
derive the alternates from `translations`, not by string-munging URLs.

### Task C — adopt the two embed placeholders to local data

This is the part that makes the syndicated articles yours rather than a
reprint. The source site's project listings and lead-capture forms are
**deliberately not exported**. Where they appeared, the HTML contains an empty
placeholder element that you replace with this portal's own equivalent:

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

The same information is in `embeds[]`, in document order, keyed by the same
`id` as `data-cvp-embed-id` — match on that instead of scraping attributes:

```jsonc
{ "id": "embed-5", "kind": "projects", "title": "Villen in Paphos",
  "criteriaSource": "filters" | "inferred" | "none",
  "criteria": { "city": "Paphos", "propertyType": "Villa",
                "priceMin": 385000, "priceMax": 1100000, "limit": 5 } }

{ "id": "embed-7", "kind": "lead-form", "title": "Form",
  "buttonText": "Anfrage senden" }
```

There are 122 embeds across the 211 articles, so this path is exercised
constantly — it is not an edge case.

**Start by finding the local equivalents in this repository.** Do not invent a
project model or a form. Locate:

1. The existing property/project entity — whatever this portal calls it — and
   the fields corresponding to city/location, property type, and price.
2. The existing component that renders a list or grid of those properties.
   Reuse it. The syndicated article should look like the rest of this portal.
3. The existing lead-capture form component and its submission endpoint.

Then implement:

**`kind: "projects"`** — query this portal's own inventory and render the local
listing component in place of the placeholder.

- `criteriaSource: "filters"` — the editor set explicit criteria. Map `city`,
  `propertyType`, `priceMin`, `priceMax` onto the local fields and honour them.
  Values are the source site's vocabulary (`"Paphos"`, `"Limassol"`,
  `"Villa"`, `"Apartment"`, …). Build an explicit mapping table from those to
  this portal's own values; do not assume the strings match. Log any value
  that fails to map, and fall back rather than rendering nothing.
- `criteriaSource: "inferred"` — the editor hand-picked individual properties
  upstream. Those are not exported; the criteria are an aggregate of what they
  had in common and are approximate by construction. Treat them as a strong
  hint: filter by them, but widen (drop price bounds first, then property
  type) if the result set comes back thin.
- `criteriaSource: "none"` — nothing to go on. Fall back to this portal's
  featured/newest properties.
- `limit` is the intended item count; default to a sensible local value
  (6–12) when it is null.
- `title` is the editor's heading in the article's language. Render it above
  the listing, styled like this portal's other section headings. When it is
  null or empty, render no heading rather than inventing one.
- **A block that would render zero properties must render nothing at all** —
  remove the placeholder entirely, including its heading. An empty "Villas in
  Paphos" section with no villas is worse than no section. Log it so thin
  inventory is visible rather than silent.
- Match the article's language: a German article gets German property cards.

**`kind: "lead-form"`** — render this portal's own lead form, wired to this
portal's own submission endpoint. `buttonText` is the editor's call-to-action
in the article's language — use it when your form component accepts a custom
label, otherwise use the local default. Never post to the source site.

Implementation note: do the replacement server-side where possible (parse the
HTML, swap the placeholder nodes for rendered components) so the listings are
in the initial HTML and indexable. A client-side hydration pass is acceptable
only if this project's architecture forces it — say so in a comment if you go
that way.

### Verification — do this, do not skip it

Before you report done, run against the live API and show the output:

1. A full sync of all four languages completes; report created/updated/failed
   counts and confirm 211 articles are present.
2. Re-running the sync produces mostly 304s and zero content changes.
3. Pick at least four articles covering: a table, an FAQ accordion, a nested
   list, inline images, and both embed kinds. Render each and confirm no raw
   placeholder `div.cvp-embed` survives in the output.
4. Confirm every rendered article page emits the correct `<link rel="canonical">`
   pointing at cyprusvipestates.com.
5. Confirm no image renders with a relative or broken `src`.
6. Confirm an article whose projects embed matches zero local properties
   renders without an empty section.
7. Confirm `unsupportedBlockTypes` is empty across the whole sync.

### Out of scope — do not do these

- Do not write back to the source API. It is read-only; there is no write path.
- Do not scrape cyprusvipestates.com as a fallback. If the API fails, fail
  loudly and keep serving the last good synced copy.
- Do not mirror the source site's visual design. Use this portal's own.
- Do not re-translate, rewrite, summarise, or "improve" article text with an
  LLM. The four language versions are separately authored editorial content.
- Do not commit the API key.
