// WP7 fix round 1 — the e-mail RTL rebuild (Pass B Must fix #1/#2/#9/#10/#16).
//
// Two jobs:
//   1. LOCK the LTR output. `fixtures/autoreply-en.html` is the byte-exact
//      English rendering as it stood BEFORE the RTL work of this round (the
//      equality was verified against `git show HEAD:` at the time the fixture
//      was written). Any future `dir`/`text-align` plumbing that leaks into an
//      LTR locale fails here instead of shipping.
//   2. Assert that `he` actually carries direction on the elements that
//      SURVIVE Gmail — not just on <html>/<body>, which Gmail, Yahoo and
//      Outlook.com strip before re-hosting the markup in their own LTR box.
//
// Pure functions only: nothing here sends, queues or persists anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAutoReplyEmail } from "@/lib/emailTemplates";
import { bodyToHtml } from "@/lib/crm/emailBodyHtml";
import { HE_LANGUAGE_NOTE } from "@/lib/locale";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("auto-reply: the English rendering is byte-identical to the pinned baseline", () => {
  const expected = readFileSync(path.join(FIXTURES, "autoreply-en.html"), "utf8");
  assert.equal(getAutoReplyEmail({ name: "Max Mustermann", lang: "en" }).html, expected);
});

test("auto-reply: no LTR locale emits a dir or a text-align, with or without a name", () => {
  for (const lang of ["en", "de", "pl", "ru"]) {
    for (const name of [undefined, "Max Mustermann"]) {
      const { html } = getAutoReplyEmail({ name, lang });
      assert.doesNotMatch(html, /dir="rtl"/, `${lang} emitted a dir`);
      assert.doesNotMatch(html, /text-align:/, `${lang} emitted a text-align`);
      assert.doesNotMatch(html, /<bdi>/, `${lang} emitted a <bdi>`);
    }
  }
});

test("auto-reply he: dir sits on both wrapper tables, every text cell, the list and every paragraph", () => {
  const raw = getAutoReplyEmail({ name: "Yossi", lang: "he" }).html;
  // The template keeps a commented-out contact block; it renders nothing.
  const html = raw.replace(/<!--[\s\S]*?-->/g, "");

  // The two tags Gmail keeps.
  assert.match(html, /<html lang="he" dir="rtl">/);
  assert.match(html, /<body [^>]*dir="rtl">/);

  // The wrappers Gmail re-hosts — these are the ones that actually matter.
  assert.match(html, /<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" dir="rtl" style="background-color:#f4f4f4/);
  assert.match(html, /<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" dir="rtl" style="max-width:600px/);
  assert.match(html, /<ul dir="rtl" style="margin:0 20px 12px 0;/);

  // Every text cell carries the attribute; the two body cells that were
  // left-aligned in LTR also carry the mirrored inline alignment (the
  // deliberately centred footer cell stays centred).
  for (const cell of html.match(/<td [^>]*>/g) ?? []) {
    if (!/color:#333333|color:#aaaaaa/.test(cell)) continue;
    assert.match(cell, /dir="rtl"/, `text cell without dir: ${cell}`);
    if (/align="right"/.test(cell)) {
      assert.match(cell, /text-align:right;/, `flipped cell without inline alignment: ${cell}`);
    }
  }
  assert.equal((html.match(/<td align="right" dir="rtl"[^>]*text-align:right;">/g) ?? []).length, 2);

  // Every paragraph — a sanitizer that drops the <td> attributes still leaves
  // these standing.
  const paragraphs = html.match(/<p[^>]*>/g) ?? [];
  assert.ok(paragraphs.length >= 6);
  for (const p of paragraphs) {
    assert.match(p, /dir="rtl"/, `paragraph without dir: ${p}`);
    assert.match(p, /text-align:(right|center);/, `paragraph without inline alignment: ${p}`);
  }
});

test("auto-reply he: the greeting is a real salutation and Entscheidung E is on the page", () => {
  const named = getAutoReplyEmail({ name: "Yossi", lang: "he" }).html;
  const anonymous = getAutoReplyEmail({ lang: "he" }).html;
  assert.match(named, /שלום <bdi>Yossi<\/bdi>,/);
  assert.match(anonymous, />שלום,</);
  // Must fix #3 — this mail goes out before any human sees the enquiry.
  assert.ok(named.includes(HE_LANGUAGE_NOTE));
  assert.ok(anonymous.includes(HE_LANGUAGE_NOTE));
});

test("auto-reply: an interpolated name is HTML-escaped in every locale", () => {
  const hostile = '<script>alert("x")</script>';
  for (const lang of ["en", "de", "pl", "ru", "he"]) {
    const { html } = getAutoReplyEmail({ name: hostile, lang });
    assert.doesNotMatch(html, /<script>/, `${lang} let a raw tag through`);
    assert.match(html, /&lt;script&gt;/, `${lang} did not escape the name`);
  }
});

test("auto-reply: the lang attribute can only ever be a known locale", () => {
  const { html } = getAutoReplyEmail({ name: "x", lang: '"><script>alert(1)</script>' });
  assert.match(html, /<html lang="en">/);
  assert.doesNotMatch(html, /<script>/);
});

test("bodyToHtml: LTR is unchanged, he carries dir and alignment on the block itself", () => {
  const body = "Hello <Max>,\n\nline two";
  const ltr = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;">Hello &lt;Max&gt;,\n\nline two</div>';
  assert.equal(bodyToHtml(body), ltr);
  for (const lang of ["en", "de", "pl", "ru"]) assert.equal(bodyToHtml(body, lang), ltr);
  assert.equal(
    bodyToHtml("שלום", "he"),
    '<div dir="rtl" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;text-align:right;">שלום</div>',
  );
});
