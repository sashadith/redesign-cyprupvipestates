import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { newMetaEventId } from "@/lib/metaEventId";
import { leadIdForServer } from "@/lib/metaPixelGate";
import {
  buildCapiPayload, freshEventId, capiConfig, capiContextFrom, capiRefusal, cookieFrom, normalizeEmail, normalizePhone,
  sendCapiEvent, validEventId, type CapiEventInput,
} from "@/lib/metaCapi";

/* The Conversions API copy of Lead and Contact (2026-11-01). Every refusal
 * below is a promise made to the user: no marketing consent → nothing leaves
 * the server; no event id → nothing leaves (it would double-count); nothing raw
 * in the payload; off production only with a test event code. */

const h = (v: string) => createHash("sha256").update(v).digest("hex");
const CONSENT = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))}`;
const REFUSED = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))}`;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const req = (cookie: string, ua = CHROME) =>
  new Request("https://cyprusvipestates.com/api/leads", {
    method: "POST",
    headers: { cookie: `${cookie}; _fbp=fb.1.1700000000000.123456789; _fbc=fb.1.1700000000000.AbCdEf`, "user-agent": ua, "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  });

const CFG = { token: "t", testEventCode: null };
const LEAD_ID = newMetaEventId("lead");
const input = (over: Partial<CapiEventInput> = {}): CapiEventInput => ({
  eventName: "Lead",
  eventId: LEAD_ID,
  eventSourceUrl: "https://cyprusvipestates.com/en/projects/x",
  ctx: capiContextFrom(req(CONSENT)),
  email: "  Jane.Doe@Example.COM ",
  phone: "+357 99 123456",
  ...over,
});

test("the request context reads consent, cookies, IP and UA", () => {
  const ctx = capiContextFrom(req(CONSENT));
  assert.equal(ctx.consent, true);
  assert.equal(ctx.bot, false);
  assert.equal(ctx.fbp, "fb.1.1700000000000.123456789");
  assert.equal(ctx.fbc, "fb.1.1700000000000.AbCdEf");
  assert.equal(ctx.ip, "203.0.113.7", "the client, not the proxy");
  assert.equal(capiContextFrom(req(REFUSED)).consent, false);
  assert.equal(capiContextFrom(req("")).consent, false, "no answer is no consent");
  assert.equal(capiContextFrom(req(CONSENT, "Googlebot/2.1 (+http://www.google.com/bot.html)")).bot, true);
});

test("only marketing consent counts — analytics alone is not enough", () => {
  const onlyAnalytics = `cookieConsent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: false }))}`;
  assert.equal(capiContextFrom(req(onlyAnalytics)).consent, false);
});

test("every refusal, and the one case that may go", () => {
  assert.equal(capiRefusal(input(), null), "not_configured");
  assert.equal(capiRefusal(input({ ctx: capiContextFrom(req(REFUSED)) }), CFG), "no_consent");
  assert.equal(capiRefusal(input({ ctx: capiContextFrom(req(CONSENT, "HeadlessChrome/131")) }), CFG), "bot");
  assert.equal(capiRefusal(input({ eventId: "" }), CFG), "no_event_id");
  assert.equal(capiRefusal(input({ eventId: newMetaEventId("contact") }), CFG), "no_event_id", "a Contact id on a Lead");
  const old = `lead-${(Date.now() - 11 * 60_000).toString(36)}-abcd1234`;
  assert.equal(capiRefusal(input({ eventId: old }), CFG), "stale_event_id", "a replayed or hand-minted id");
  assert.equal(capiRefusal(input({ eventSourceUrl: "http://localhost:3000/en" }), CFG), "not_production");
  assert.equal(capiRefusal(input({ eventSourceUrl: "https://design.cyprusvipestates.com/en" }), CFG), "not_production");
  assert.equal(capiRefusal(input({ eventSourceUrl: "http://localhost:3000/en" }), { token: "t", testEventCode: "TEST123" }), null, "a test code opens the testbed");
  assert.equal(capiRefusal(input(), CFG), null);
});

test("configuration needs the token AND the pixel switch", () => {
  assert.equal(capiConfig({ META_CAPI_TOKEN: "t" }), null, "token without the switch");
  assert.equal(capiConfig({ NEXT_PUBLIC_META_PIXEL_ENABLED: "1" }), null, "switch without a token");
  assert.deepEqual(capiConfig({ META_CAPI_TOKEN: " t ", NEXT_PUBLIC_META_PIXEL_ENABLED: "1" }), { token: "t", testEventCode: null });
  assert.deepEqual(capiConfig({ META_CAPI_TOKEN: "t", NEXT_PUBLIC_META_PIXEL_ENABLED: "1", META_CAPI_TEST_EVENT_CODE: "TEST1" }), { token: "t", testEventCode: "TEST1" });
});

test("the payload hashes email and phone and carries nothing raw", () => {
  const body = buildCapiPayload(input(), CFG);
  const ev = body.data[0] as any;
  assert.equal(ev.event_name, "Lead");
  assert.equal(ev.event_id, LEAD_ID);
  assert.equal(ev.action_source, "website");
  assert.equal(ev.event_source_url, "https://cyprusvipestates.com/en/projects/x");
  assert.deepEqual(ev.user_data.em, [h("jane.doe@example.com")]);
  assert.deepEqual(ev.user_data.ph, [h("35799123456")]);
  assert.equal(ev.user_data.fbp, "fb.1.1700000000000.123456789");
  assert.equal(ev.user_data.fbc, "fb.1.1700000000000.AbCdEf");
  assert.equal(ev.user_data.client_ip_address, "203.0.113.7");
  assert.equal(ev.user_data.client_user_agent, CHROME);
  const json = JSON.stringify(body);
  assert.ok(!/jane|example\.com|99 ?123456/i.test(json), "a raw email or phone reached the payload");
  assert.ok(!("test_event_code" in body));
  assert.equal((buildCapiPayload(input(), { token: "t", testEventCode: "TEST9" }) as any).test_event_code, "TEST9");
});

test("Contact carries no email or phone at all", () => {
  const ev = buildCapiPayload(input({ eventName: "Contact", eventId: newMetaEventId("contact"), email: null, phone: null }), CFG).data[0] as any;
  assert.ok(!("em" in ev.user_data) && !("ph" in ev.user_data));
  assert.ok(ev.user_data.fbp && ev.user_data.client_user_agent);
});

test("normalisation follows Meta's rules", () => {
  assert.equal(normalizeEmail(" A@B.CO "), "a@b.co");
  assert.equal(normalizeEmail("nope"), null);
  assert.equal(normalizePhone("+357 99 123456"), "35799123456");
  assert.equal(normalizePhone("099 123456"), null, "no country code: the hash would match nobody");
  assert.equal(cookieFrom("a=1; _fbp=x.y; b=2", "_fbp"), "x.y");
  assert.equal(cookieFrom("a_fbp=1", "_fbp"), null);
});

test("an id is fresh for ten minutes, with a minute of clock skew", () => {
  const now = Date.now();
  const at = (t: number) => `lead-${t.toString(36)}-abcd1234`;
  assert.equal(freshEventId(at(now - 9 * 60_000), now), true);
  assert.equal(freshEventId(at(now - 11 * 60_000), now), false);
  assert.equal(freshEventId(at(now + 30_000), now), true);
  assert.equal(freshEventId(at(now + 5 * 60_000), now), false);
  assert.equal(freshEventId("lead-zz-", now), false);
});

test("the client IP is nginx's X-Real-IP, not a forwarded-for the client wrote", () => {
  const r = new Request("https://cyprusvipestates.com/x", { headers: { "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.2.3.4, 198.51.100.1" } });
  assert.equal(capiContextFrom(r).ip, "198.51.100.1");
});

test("ids are only what our generator makes", () => {
  assert.equal(validEventId("Lead", "lead-mh1abc-x9y8z7w6"), true);
  assert.equal(validEventId("Contact", "contact-mh1abc-x9y8z7w6"), true);
  for (const bad of [undefined, null, 42, "", "lead-", "lead-ABC-def", "lead-a-b-c", "lead-a-b\n", "x".repeat(50)])
    assert.equal(validEventId("Lead", bad), false, JSON.stringify(bad));
});

test("sending: refused never calls out, accepted posts to Graph, failure never throws", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  let status = 200;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}", { status });
  }) as any;
  try {
    assert.equal(await sendCapiEvent(input({ ctx: capiContextFrom(req(REFUSED)) }), CFG), false);
    assert.equal(calls.length, 0, "a refused event reached the network");
    assert.equal(await sendCapiEvent(input(), CFG), true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/1238429281352397\/events$/);
    assert.equal((calls[0].init.headers as any).Authorization, "Bearer t");
    assert.ok(!String(calls[0].init.body).includes('"t"'), "the token is a header, not body");
    status = 400;
    assert.equal(await sendCapiEvent(input(), CFG), false);
    globalThis.fetch = (async () => { throw new Error("network down"); }) as any;
    assert.equal(await sendCapiEvent(input(), CFG), false, "a network error resolved false");
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* ── the call sites ─────────────────────────────────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "__tests__") walk(p, out); }
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = walk(join(process.cwd(), "src"));
const rel = (p: string) => p.slice(process.cwd().length + 1);

test("every browser Lead posts its id, and reuses it for fbq", () => {
  const sites = FILES.filter((f) => /fbq!?\s*\(\s*["']track["']\s*,\s*["']Lead["']/.test(readFileSync(f, "utf8")));
  assert.ok(sites.length >= 8, `only ${sites.length} Lead sites found — the sweep is looking in the wrong place`);
  const bad = sites.filter((f) => {
    const s = readFileSync(f, "utf8");
    return !/const metaEventId = newMetaEventId\("lead"\)/.test(s) || !/\n\s*metaEventId: leadIdForServer\(metaEventId\),\n/.test(s) || !/\{ eventID: metaEventId \}/.test(s);
  });
  assert.deepEqual(bad.map(rel), [], "a Lead form does not send its event id to the server, or makes a second one for fbq");
});

test("every lead route that answers a browser Lead sends the server copy", () => {
  for (const r of ["src/app/api/leads/route.ts", "src/app/api/roi-calculator/route.ts", "src/app/api/email/route.ts"]) {
    const s = readFileSync(join(process.cwd(), r), "utf8");
    assert.ok(/void sendLeadToMeta\(request, body, \{/.test(s), `${r} no longer sends the Lead to the Conversions API`);
    // After the lead is stored, never before: a server Lead for a lead that
    // failed to save would be a conversion nobody can follow up.
    assert.ok(s.indexOf("sendLeadToMeta(request") > s.indexOf("prisma.lead.create("), `${r} sends before the lead is saved`);
  }
});

test("automated browsers post no Lead id — the webdriver half of the bot rule", () => {
  const nav = (v: object) => Object.defineProperty(globalThis, "navigator", { value: v, configurable: true });
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  process.env.NEXT_PUBLIC_META_PIXEL_ENABLED = "1";
  nav({ userAgent: chrome, webdriver: false });
  assert.equal(leadIdForServer("lead-a-b"), "lead-a-b");
  nav({ userAgent: chrome, webdriver: true });
  assert.equal(leadIdForServer("lead-a-b"), undefined, "Playwright with a real Chrome UA");
  nav({ userAgent: "Mozilla/5.0 HeadlessChrome/131.0" });
  assert.equal(leadIdForServer("lead-a-b"), undefined);
  nav({ userAgent: chrome });
  delete process.env.NEXT_PUBLIC_META_PIXEL_ENABLED;
  assert.equal(leadIdForServer("lead-a-b"), undefined, "switch off");
});

test("Contact goes through the one helper, never a bare fbq", () => {
  const bare = FILES.filter((f) => !f.endsWith("lib/metaContact.ts")).filter((f) =>
    /fbq!?\s*\(\s*["']track["']\s*,\s*["']Contact["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(bare.map(rel), [], "a Contact event skips trackMetaContact — its server copy would be missing");
});

test("the Meta lead webhook and poller are not wired to the Conversions API", () => {
  // Their leads come FROM Meta (Lead Ads); a server Lead for them would report
  // Meta's own conversion back to it a second time.
  for (const f of FILES.filter((f) => /meta-?leadgen|metaLeadgen/i.test(f))) {
    assert.ok(!/metaCapi|sendLeadToMeta|sendCapiEvent/.test(readFileSync(f, "utf8")), `${rel(f)} sends CAPI events`);
  }
});
