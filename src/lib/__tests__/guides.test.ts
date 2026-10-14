import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { signGuideToken, verifyGuideToken, GUIDE_TOKEN_TTL_MS, guideDownloadPath } from "../guides/token";
import { GUIDE_IDS, guideForArticle, getGuideContent, guideTeaser, isGuideId, guideLangFor } from "../guides/registry";
import { GUIDE_LANGS } from "../guides/types";
import articles from "../guides/articles.json";
import { getGuideEmail } from "../guides/email";
import { readGuidePdf } from "../guides/files";

process.env.GUIDE_TOKEN_SECRET = "test-secret";
const ROOT = path.resolve(__dirname, "../../..");

test("token: valid for its guide and language, rejected for anything else", () => {
  const now = 1_800_000_000_000;
  const t = signGuideToken("cost-of-buying", "de", now);
  assert.equal(verifyGuideToken("cost-of-buying", "de", t, now + 1000), true);
  assert.equal(verifyGuideToken("cost-of-buying", "en", t, now + 1000), false);
  assert.equal(verifyGuideToken("residency", "de", t, now + 1000), false);
  assert.equal(verifyGuideToken("cost-of-buying", "de", t, now + GUIDE_TOKEN_TTL_MS + 1), false);
  const last = t[t.length - 1];
  assert.equal(verifyGuideToken("cost-of-buying", "de", t.slice(0, -1) + (last === "A" ? "B" : "A"), now + 1000), false);
  assert.equal(verifyGuideToken("cost-of-buying", "de", "", now), false);
  assert.equal(verifyGuideToken("cost-of-buying", "de", null, now), false);
  assert.equal(verifyGuideToken("cost-of-buying", "de", "a.b.c", now), false);
  assert.equal(verifyGuideToken("cost-of-buying", "de", "x".repeat(200), now), false);
});

test("token: download path carries a token that verifies", () => {
  const p = guideDownloadPath("residency", "ru", 1_800_000_000_000);
  const u = new URL("https://x.test" + p);
  assert.equal(u.pathname, "/api/guides/residency");
  assert.equal(u.searchParams.get("lang"), "ru");
  assert.equal(verifyGuideToken("residency", "ru", u.searchParams.get("t"), 1_800_000_000_000 + 5), true);
});

test("registry: an article offers at most one guide, every guide has articles in every language", () => {
  const seen = new Map<string, string>();
  for (const id of GUIDE_IDS) {
    for (const lang of GUIDE_LANGS) {
      const slugs = (articles as Record<string, Record<string, string[]>>)[id][lang];
      assert.ok(slugs.length >= 1, `${id}/${lang} has no articles`);
      for (const slug of slugs) {
        const key = `${lang}:${slug}`;
        assert.equal(seen.has(key), false, `${key} offered by both ${seen.get(key)} and ${id}`);
        seen.set(key, id);
        assert.equal(guideForArticle(lang, slug), id);
      }
    }
  }
  assert.equal(guideForArticle("en", "no-such-article"), null);
  assert.equal(isGuideId("residency"), true);
  assert.equal(isGuideId("../etc/passwd"), false);
  assert.equal(guideLangFor("he"), "en");
});

test("content: every guide exists in all four languages and passes the structure check", () => {
  const files = GUIDE_IDS.flatMap((id) => GUIDE_LANGS.map((l) => path.join(ROOT, "src/lib/guides/content", `${id}.${l}.json`)));
  for (const f of files) assert.ok(fs.existsSync(f), `missing ${f}`);
  execFileSync("node", [path.join(ROOT, "scripts/guides/validate-content.mjs"), ...files], { stdio: "pipe" });
  for (const id of GUIDE_IDS) {
    execFileSync("node", [path.join(ROOT, "scripts/guides/check-parity.mjs"), id], { stdio: "pipe" });
    for (const l of GUIDE_LANGS) {
      const c = getGuideContent(id, l);
      assert.equal(c.id, id);
      assert.equal(c.lang, l);
      assert.equal(guideTeaser(id, l).inside.length, 4);
    }
  }
});

test("email: guide e-mail has the absolute link, escapes the name and is localised", () => {
  for (const lang of GUIDE_LANGS) {
    const { subject, html } = getGuideEmail({ name: `<b>"Ann"</b>`, lang, title: "T & Co", url: "https://cyprusvipestates.com/api/guides/x?lang=en&t=abc.def" });
    assert.ok(subject.includes("T & Co"));
    assert.ok(html.includes('href="https://cyprusvipestates.com/api/guides/x?lang=en&amp;t=abc.def"'));
    assert.ok(!html.includes("<b>"), "name must be escaped");
    assert.ok(html.includes(`lang="${lang}"`));
  }
});

test("pdf: every built PDF is current for its content and layout, is a real multi-page PDF, and stays small", async () => {
  // Fails when a content file or the layout changed without `node scripts/guides/build-pdfs.mjs`.
  execFileSync("node", [path.join(ROOT, "scripts/guides/build-pdfs.mjs"), "--check"], { stdio: "pipe" });
  // The packed PDFs keep their page tree inside object streams, so count pages with a real reader, not a regex.
  const pdfjs = createRequire(import.meta.url)("pdfjs-dist/legacy/build/pdf.js");
  for (const id of GUIDE_IDS) for (const lang of GUIDE_LANGS) {
    const buf = readGuidePdf(id, lang);
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
    assert.ok(doc.numPages >= 5 && doc.numPages <= 9, `${id}.${lang}: ${doc.numPages} pages`);
    // Chrome's raw output is 740-920 KB; scripts/guides/optimize-pdf.py brings it to 330-390 KB. Visitors download these on any connection.
    assert.ok(buf.length < 450 * 1024, `${id}.${lang}: ${Math.round(buf.length / 1024)} KB, run scripts/guides/optimize-pdf.py`);
  }
});

import { parseGuideRequest, messageWithGuide, guideNote, guideLink } from "../guides/request";

test("request: a guide submission is recognised, anything else stays a plain enquiry", () => {
  const g = parseGuideRequest({ guide: "cost-of-buying" }, "de");
  assert.ok(g);
  assert.equal(g!.id, "cost-of-buying");
  assert.equal(g!.lang, "de");
  assert.equal(g!.title, getGuideContent("cost-of-buying", "de").title);
  assert.equal(parseGuideRequest({ guide: "he" }, "en"), null);
  assert.equal(parseGuideRequest({ guide: "../../etc/passwd" }, "en"), null);
  assert.equal(parseGuideRequest({ guide: ["residency"] }, "en"), null);
  assert.equal(parseGuideRequest({}, "en"), null);
  // unknown/gated languages read the English guide
  assert.equal(parseGuideRequest({ guide: "residency" }, "he")!.lang, "en");
  assert.equal(parseGuideRequest({ guide: "residency" }, "")!.lang, "en");
});

test("request: message, note and link only change for guide requests", () => {
  assert.equal(messageWithGuide("hello", null), "hello");
  assert.equal(guideNote(null), "");
  assert.equal(guideLink(null), null);
  const g = parseGuideRequest({ guide: "rent-or-buy" }, "pl")!;
  assert.equal(messageWithGuide("", g), `[Guide] ${g.title} (PL)`);
  assert.equal(messageWithGuide("question", g), `question\n[Guide] ${g.title} (PL)`);
  assert.equal(guideNote(g), "Lead magnet: rent-or-buy");
  const link = guideLink(g)!;
  assert.ok(link.startsWith("/api/guides/rent-or-buy?lang=pl&t="));
  const t = new URL("https://x.test" + link).searchParams.get("t");
  assert.equal(verifyGuideToken("rent-or-buy", "pl", t), true);
});

import { GET } from "../../app/api/guides/[id]/route";

const call = (id: string, qs: string) => GET(new Request(`https://x.test/api/guides/${id}${qs}`), { params: { id } });

test("route: serves the PDF only for a valid token; unknown guide/language 404; bad token gets a localised 403 page", async () => {
  const t = signGuideToken("residency", "pl");
  const ok = await call("residency", `?lang=pl&t=${t}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "application/pdf");
  assert.match(ok.headers.get("content-disposition") ?? "", /^attachment; filename="cyprus-vip-estates-residency-pl\.pdf"$/);
  assert.equal(ok.headers.get("x-robots-tag"), "noindex, nofollow");
  const body = Buffer.from(await ok.arrayBuffer());
  assert.equal(body.subarray(0, 5).toString(), "%PDF-");
  assert.deepEqual(body, readGuidePdf("residency", "pl"));

  assert.equal((await call("nope", `?lang=pl&t=${t}`)).status, 404);
  assert.equal((await call("residency", `?lang=he&t=${t}`)).status, 404);
  assert.equal((await call("../../etc/passwd", `?lang=pl&t=${t}`)).status, 404);

  for (const qs of ["?lang=pl", `?lang=en&t=${t}`, "?lang=pl&t=garbage"]) {
    const bad = await call("residency", qs);
    assert.equal(bad.status, 403, qs);
    assert.match(bad.headers.get("content-type") ?? "", /text\/html/);
  }
  const pl = await (await call("residency", "?lang=pl")).text();
  assert.ok(pl.includes("wygasł"), "the 403 page speaks the visitor's language");
});

test("route: with no signing secret configured it answers 503 instead of serving or crashing", async () => {
  const t = signGuideToken("residency", "en");
  const saved = { a: process.env.AUTH_SECRET, g: process.env.GUIDE_TOKEN_SECRET };
  delete process.env.AUTH_SECRET; delete process.env.GUIDE_TOKEN_SECRET;
  const errors: unknown[] = [];
  const orig = console.error; console.error = (...a: unknown[]) => { errors.push(a); };
  try {
    assert.equal((await call("residency", `?lang=en&t=${t}`)).status, 503);
    assert.equal(guideLink(parseGuideRequest({ guide: "residency" }, "en")), null); // the lead flow degrades, it does not throw
    assert.ok(errors.length >= 2);
  } finally {
    console.error = orig;
    process.env.GUIDE_TOKEN_SECRET = saved.g ?? "test-secret";
    if (saved.a !== undefined) process.env.AUTH_SECRET = saved.a;
  }
});

import { CONTACT } from "../guides/html";

test("contacts: the PDFs print exactly the contact details the site shows", () => {
  const channels = fs.readFileSync(path.join(ROOT, "src/app/components/ContactChannels/ContactChannels.tsx"), "utf8");
  assert.ok(channels.includes(`"${CONTACT.phone}"`), "phone differs from ContactChannels");
  assert.ok(channels.includes(`"${CONTACT.whatsapp}"`), "WhatsApp number differs from ContactChannels");
  assert.ok(channels.includes(`"${CONTACT.email}"`), "e-mail differs from ContactChannels");
  const layout = fs.readFileSync(path.join(ROOT, "src/app/[lang]/layout.tsx"), "utf8");
  assert.ok(layout.includes(`telephone: "${CONTACT.phone.replace(/\s/g, "")}"`), "phone differs from the site's structured data");
});
