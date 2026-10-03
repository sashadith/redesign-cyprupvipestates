import { test } from "node:test";
import assert from "node:assert/strict";
import { createTypefullyClient, CACHE_TTL_MS, type DraftListResult, type TypefullyDraft } from "@/lib/social/typefully";
import { socialActionItems, socialDigestLines, draftLink, platformsOf, NO_WEEK_DRAFTS_LINE } from "@/lib/social/socialMonitor";

/* Social monitoring over Typefully (2026-10-03). Typefully is mocked throughout:
   no test here, and nothing in the testbed, may reach the real API. */

const HOUR = 3_600_000;
// Monday 5 Oct 2026, 08:00 in Cyprus (UTC+3) — the digest's own firing time.
const MONDAY = new Date("2026-10-05T05:00:00Z");
// Wednesday 7 Oct 2026, same time.
const WEDNESDAY = new Date("2026-10-07T05:00:00Z");

let nextId = 1000;
function draft(status: string, scheduledAt: Date | null, extra: Partial<TypefullyDraft> = {}): TypefullyDraft {
  return {
    id: nextId++, status, scheduled_date: scheduledAt ? scheduledAt.toISOString() : null,
    draft_title: "Living in Limassol", preview: "Preview text", linkedin_post_enabled: true, x_post_enabled: false,
    created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", ...extra,
  };
}
const ok = (drafts: TypefullyDraft[]): DraftListResult => ({ ok: true, drafts, truncated: false });
const EMPTY = ok([]);
const fail = (status: number | null, message = "boom"): DraftListResult => ({ ok: false, status, message });

/* ── Action Center rules ─────────────────────────────────────────────────── */

test("planned draft 60h ahead → ACTION (the brief's WARN)", () => {
  const d = draft("planned", new Date(WEDNESDAY.getTime() + 60 * HOUR));
  const items = socialActionItems({ planned: ok([d]), errored: EMPTY }, WEDNESDAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, `social-unconfirmed:${d.id}`);
  assert.equal(items[0].severity, "ACTION");
  assert.equal(items[0].category, "SOCIAL");
  assert.equal(items[0].deepLink, `https://typefully.com/?d=${d.id}&a=339303`);
  assert.match(items[0].title, /Living in Limassol/);
  assert.match(items[0].description, /Fri,? 09 Oct, 20:00 \(Cyprus\) on LinkedIn/, "date/time in Cyprus, platform named");
});

test("planned draft 10h ahead → URGENT", () => {
  const d = draft("planned", new Date(WEDNESDAY.getTime() + 10 * HOUR));
  const [item] = socialActionItems({ planned: ok([d]), errored: EMPTY }, WEDNESDAY);
  assert.equal(item.severity, "URGENT");
});

test("the 12h and 72h edges: exactly 12h is URGENT, 73h is no item yet", () => {
  const edge = draft("planned", new Date(WEDNESDAY.getTime() + 12 * HOUR));
  const far = draft("planned", new Date(WEDNESDAY.getTime() + 73 * HOUR));
  const items = socialActionItems({ planned: ok([edge, far]), errored: EMPTY }, WEDNESDAY);
  assert.deepEqual(items.map((i) => [i.id, i.severity]), [[`social-unconfirmed:${edge.id}`, "URGENT"]]);
});

test("a scheduled draft produces no item (only the 'planned' list feeds the rule)", () => {
  // The rule is fed the planned and error lists only; a scheduled draft can only
  // reach it if the API mislabels it, and then it still must not raise anything
  // for a status other than planned/error.
  const items = socialActionItems({ planned: EMPTY, errored: EMPTY }, WEDNESDAY);
  assert.deepEqual(items, []);
});

test("error draft → URGENT social-publish-error", () => {
  const d = draft("error", new Date(WEDNESDAY.getTime() - 2 * HOUR), { x_post_enabled: true });
  const [item] = socialActionItems({ planned: EMPTY, errored: ok([d]) }, WEDNESDAY);
  assert.equal(item.id, `social-publish-error:${d.id}`);
  assert.equal(item.severity, "URGENT");
  assert.match(item.description, /X, LinkedIn/);
});

test("planned draft whose date passed unconfirmed → URGENT social-missed (last 7 days only)", () => {
  const missed = draft("planned", new Date(WEDNESDAY.getTime() - 5 * HOUR));
  const ancient = draft("planned", new Date(WEDNESDAY.getTime() - 8 * 24 * HOUR));
  const items = socialActionItems({ planned: ok([missed, ancient]), errored: EMPTY }, WEDNESDAY);
  assert.deepEqual(items.map((i) => [i.id, i.severity]), [[`social-missed:${missed.id}`, "URGENT"]]);
});

test("API 500 → social-api-unreachable with the status code, never 'no items'", async () => {
  const client = createTypefullyClient({ apiKey: () => "k", fetchImpl: async () => new Response("{\"error\":{\"message\":\"Internal\"}}", { status: 500 }) });
  const planned = await client.listDrafts("planned");
  const errored = await client.listDrafts("error");
  const items = socialActionItems({ planned, errored }, WEDNESDAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "social-api-unreachable");
  assert.equal(items[0].severity, "ACTION");
  assert.match(items[0].title, /HTTP 500/);
});

test("a missing API key is its own explicit item", async () => {
  const client = createTypefullyClient({ apiKey: () => undefined, fetchImpl: async () => { throw new Error("must not be called"); } });
  const items = socialActionItems({ planned: await client.listDrafts("planned"), errored: await client.listDrafts("error") }, WEDNESDAY);
  assert.equal(items[0].id, "social-api-unreachable");
  assert.match(items[0].title, /not configured/);
});

/* ── Client: read-only, no-store, paging, 5-minute memo ──────────────────── */

function recordingFetch(pages: unknown[][], status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const offset = Number(new URL(url).searchParams.get("offset"));
    const results = pages[offset / 50] ?? [];
    const next = pages[offset / 50 + 1] ? "next-page" : "";
    return new Response(JSON.stringify({ results, count: 0, limit: 50, offset, next, previous: "" }), { status });
  };
  return { calls, fetchImpl };
}

test("every request is a GET with cache: no-store and a Bearer key — the client cannot write", async () => {
  const { calls, fetchImpl } = recordingFetch([[draft("planned", null)]]);
  const client = createTypefullyClient({ apiKey: () => "secret", fetchImpl });
  for (const s of ["draft", "scheduled", "planned", "published", "error", "publishing"] as const) await client.listDrafts(s);
  assert.equal(calls.length, 6);
  for (const c of calls) {
    assert.equal(c.init.method, "GET");
    assert.equal(c.init.cache, "no-store");
    assert.equal((c.init.headers as Record<string, string>).Authorization, "Bearer secret");
    assert.match(c.url, /^https:\/\/api\.typefully\.com\/v2\/social-sets\/339303\/drafts\?status=\w+&limit=50&offset=0$/);
  }
  assert.deepEqual(Object.keys(client), ["listDrafts"], "no other operation exists on the client");
});

test("pages are followed until a short page", async () => {
  const full = Array.from({ length: 50 }, () => draft("planned", null));
  const { calls, fetchImpl } = recordingFetch([full, [draft("planned", null)]]);
  const r = await createTypefullyClient({ apiKey: () => "k", fetchImpl }).listDrafts("planned");
  assert.equal(calls.length, 2);
  assert.ok(r.ok && r.drafts.length === 51 && !r.truncated);
});

test("successes are memoised for 5 minutes, failures are not", async () => {
  let clock = 0;
  const { calls, fetchImpl } = recordingFetch([[draft("planned", null)]]);
  const client = createTypefullyClient({ apiKey: () => "k", fetchImpl, now: () => clock });
  await client.listDrafts("planned");
  clock = CACHE_TTL_MS - 1;
  await client.listDrafts("planned");
  assert.equal(calls.length, 1, "served from memory inside the TTL");
  clock = CACHE_TTL_MS;
  await client.listDrafts("planned");
  assert.equal(calls.length, 2, "refetched once the TTL is over");

  let n = 0;
  const flaky = createTypefullyClient({ apiKey: () => "k", fetchImpl: async () => { n++; return new Response("", { status: 503 }); } });
  await flaky.listDrafts("error");
  await flaky.listDrafts("error");
  assert.equal(n, 2, "a failure is retried on the next call");
});

test("a network error is a result with status null, not a throw", async () => {
  const client = createTypefullyClient({ apiKey: () => "k", fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  const r = await client.listDrafts("planned");
  assert.deepEqual(r.ok, false);
  assert.ok(!r.ok && r.status === null && /fetch failed/.test(r.message));
});

test("platforms come from every *_post_enabled flag, in a fixed order", () => {
  assert.deepEqual(platformsOf(draft("planned", null, { x_post_enabled: true, threads_post_enabled: true })), ["X", "LinkedIn", "Threads"]);
  assert.equal(draftLink(42), "https://typefully.com/?d=42&a=339303");
});

/* ── Morning digest ──────────────────────────────────────────────────────── */

const thisWeek = (dayOffset: number, hourCyprus: number) => new Date(Date.UTC(2026, 9, 5 + dayOffset, hourCyprus - 3)); // Cyprus = UTC+3 in October

test("Monday with no drafts dated Tue–Fri → the 'routine may not have run' line", () => {
  const lines = socialDigestLines({ scheduled: EMPTY, planned: EMPTY, errored: EMPTY, rest: [EMPTY, EMPTY, EMPTY] }, MONDAY);
  assert.deepEqual(lines, ["", "<b>📣 SOCIAL</b>", `• ${NO_WEEK_DRAFTS_LINE}`]);
});

test("Monday with a draft (any status) dated this Thursday → no such line", () => {
  const lines = socialDigestLines({ scheduled: EMPTY, planned: EMPTY, errored: EMPTY, rest: [ok([draft("draft", thisWeek(3, 10))]), EMPTY, EMPTY] }, MONDAY);
  assert.deepEqual(lines, []);
});

test("Monday: a draft dated next Monday does not count for this week", () => {
  const lines = socialDigestLines({ scheduled: EMPTY, planned: EMPTY, errored: EMPTY, rest: [ok([draft("draft", thisWeek(7, 10))]), EMPTY, EMPTY] }, MONDAY);
  assert.ok(lines.includes(`• ${NO_WEEK_DRAFTS_LINE}`));
});

test("non-Monday with no drafts → no line, and the whole section is absent", () => {
  assert.deepEqual(socialDigestLines({ scheduled: EMPTY, planned: EMPTY, errored: EMPTY }, WEDNESDAY), []);
});

test("Monday with a failed list never claims the routine did not run — it reports the failure", () => {
  const lines = socialDigestLines({ scheduled: EMPTY, planned: EMPTY, errored: EMPTY, rest: [fail(401, "invalid key"), EMPTY, EMPTY] }, MONDAY);
  assert.ok(lines.some((l) => /Typefully API returned HTTP 401/.test(l)));
  assert.ok(!lines.some((l) => l.includes(NO_WEEK_DRAFTS_LINE)));
});

test("digest lists today's scheduled posts, unconfirmed (48h), missed and errors", () => {
  const today = draft("scheduled", new Date(WEDNESDAY.getTime() + 4 * HOUR), { draft_title: "Today <post>" });
  const tomorrow = draft("scheduled", new Date(WEDNESDAY.getTime() + 28 * HOUR));
  const soon = draft("planned", new Date(WEDNESDAY.getTime() + 30 * HOUR), { draft_title: "Soon" });
  const later = draft("planned", new Date(WEDNESDAY.getTime() + 60 * HOUR), { draft_title: "Later" });
  const missed = draft("planned", new Date(WEDNESDAY.getTime() - 20 * HOUR), { draft_title: "Gone" });
  const broken = draft("error", null, { draft_title: "Broken" });
  const lines = socialDigestLines({ scheduled: ok([today, tomorrow]), planned: ok([soon, later, missed]), errored: ok([broken]) }, WEDNESDAY);
  assert.equal(lines[1], "<b>📣 SOCIAL</b>");
  const body = lines.slice(2);
  assert.equal(body.length, 4, body.join("\n"));
  assert.match(body[0], /^• Today 12:00 · LinkedIn · <a href="https:\/\/typefully\.com\/\?d=\d+&a=339303">Today &lt;post&gt;<\/a>$/);
  assert.match(body[1], /Missed, never confirmed .*Gone/);
  assert.match(body[2], /Not confirmed · Thu,? 08 Oct, 14:00 .*Soon/);
  assert.match(body[3], /Publish error .*Broken/);
});

test("API failure is said explicitly in the digest", () => {
  const lines = socialDigestLines({ scheduled: fail(500), planned: EMPTY, errored: EMPTY }, WEDNESDAY);
  assert.ok(lines.some((l) => /⚠️ Typefully API returned HTTP 500/.test(l)));
});
