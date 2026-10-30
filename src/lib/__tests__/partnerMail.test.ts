import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";
import {
  buildApprovedEmail, buildRegistrationNotice, buildResetEmail, buildVerifyEmail, escapeHtml, partnerBaseUrl,
} from "@/lib/partner/mail";
import { partnerClientIp } from "@/lib/partner/clientIp";
import { agreementText, PARTNER_AGREEMENT_VERSION } from "@/lib/partner/agreement";
import { validateProfile } from "@/lib/partner/registration";

const LINK = "https://partner.example.com/verify?token=abc_DEF-123";
const builders = {
  verify: (l: (typeof PARTNER_LOCALES)[number], name: string) => buildVerifyEmail(l, LINK, name),
  reset: (l: (typeof PARTNER_LOCALES)[number], name: string) => buildResetEmail(l, LINK, name),
  approved: (l: (typeof PARTNER_LOCALES)[number], name: string) => buildApprovedEmail(l, name, LINK),
};

test("mail: subject per locale, non-empty and translated", () => {
  for (const [kind, build] of Object.entries(builders)) {
    const enSubject = build("en", "Anna").subject;
    assert.ok(enSubject.trim(), kind);
    for (const l of PARTNER_LOCALES) {
      const m = build(l, "Anna");
      assert.ok(m.subject.trim().length > 0, `${kind} ${l}`);
      if (l !== "en") assert.notEqual(m.subject, enSubject, `${kind} ${l}`);
    }
  }
});

test("mail: link present in text and html, no password content", () => {
  for (const [kind, build] of Object.entries(builders)) {
    for (const l of PARTNER_LOCALES) {
      const m = build(l, "Anna");
      assert.ok(m.text.includes(LINK), `${kind} ${l} text`);
      assert.ok(m.html.includes(`href="${LINK}"`), `${kind} ${l} html`);
      // No password or password-like value is ever put into a mail.
      assert.doesNotMatch(m.text + m.html, /a-long-password|passwordHash|\$2[aby]\$/);
      assert.doesNotMatch(m.html, /<script/i);
    }
  }
});

test("mail: CI logo at the top of every html mail (absolute URL, sized, alt), text part has no image", () => {
  const logo = `${partnerBaseUrl()}/crm/brand/logo-full.png`;
  for (const [kind, build] of Object.entries(builders)) {
    for (const l of PARTNER_LOCALES) {
      const m = build(l, "Anna");
      const imgs = m.html.match(/<img\b[^>]*>/gi) ?? [];
      assert.equal(imgs.length, 1, `${kind} ${l}: exactly one image`);
      assert.ok(imgs[0].includes(`src="${logo}"`), `${kind} ${l}: logo src`);
      assert.match(imgs[0], /^<img src="https?:\/\//, `${kind} ${l}: absolute URL`);
      assert.match(imgs[0], /width="250" height="35" alt="Cyprus VIP Estates"/, `${kind} ${l}: size + alt`);
      assert.ok(m.html.indexOf("<img") < m.html.indexOf(`href="${LINK}"`), `${kind} ${l}: logo above the button`);
      assert.doesNotMatch(m.text, /logo-full|<img/i, `${kind} ${l}: text unchanged`);
    }
  }
});

test("mail: name is HTML-escaped in html, plain in text", () => {
  const m = buildApprovedEmail("en", "<b>Anna</b> & Co", LINK);
  assert.ok(m.html.includes("&lt;b&gt;Anna&lt;/b&gt; &amp; Co"));
  assert.ok(!m.html.includes("<b>Anna</b>"));
  assert.ok(m.text.includes("<b>Anna</b> & Co"));
  const v = buildVerifyEmail("de", LINK, "<i>x</i>");
  assert.ok(!v.html.includes("<i>x</i>"));
});

test("mail: missing name drops a name greeting instead of 'Dear ,'", () => {
  const m = buildVerifyEmail("en", LINK);
  assert.doesNotMatch(m.text, /Dear\s*,/);
  assert.ok(buildVerifyEmail("pl", LINK).text.startsWith("Szanowni"));
});

test("mail: link with quotes cannot break out of the href", () => {
  const m = buildResetEmail("en", 'https://x.test/reset?token="><script>', "A");
  assert.ok(!m.html.includes('"><script>'));
});

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("partnerBaseUrl", () => {
  assert.equal(partnerBaseUrl({ PARTNER_HOST: "partner.cyprusvipestates.com" }), "https://partner.cyprusvipestates.com");
  assert.equal(partnerBaseUrl({ PARTNER_HOST: " partner.cyprusvipestates.com. " }), "https://partner.cyprusvipestates.com");
  assert.equal(partnerBaseUrl({}), "http://partner.localhost:3000");
  assert.equal(partnerBaseUrl({ PARTNER_HOST: "" }), "http://partner.localhost:3000");
});
test("partnerBaseUrl: production without PARTNER_HOST throws (never a localhost link in a mail)", () => {
  assert.throws(() => partnerBaseUrl({ NODE_ENV: "production" }), /PARTNER_HOST/);
  assert.throws(() => partnerBaseUrl({ NODE_ENV: "production", PARTNER_HOST: "  " }), /PARTNER_HOST/);
  assert.equal(partnerBaseUrl({ NODE_ENV: "production", PARTNER_HOST: "partner.cyprusvipestates.com" }), "https://partner.cyprusvipestates.com");
});

test("registration notice: English, escaped, company first", () => {
  assert.equal(
    buildRegistrationNotice({ company: "A&B <Ltd>", firstName: "Anna", lastName: "Meier", country: "DE" }),
    "New partner registration: A&amp;B &lt;Ltd&gt;, DE → /crm/partners",
  );
  assert.equal(
    buildRegistrationNotice({ company: null, firstName: "Anna", lastName: "Meier", country: "PL" }),
    "New partner registration: Anna Meier, PL → /crm/partners",
  );
});

const H = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
test("partnerClientIp: x-real-ip first, else LAST forwarded hop, else null", () => {
  assert.equal(partnerClientIp(H({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "203.0.113.7");
  assert.equal(partnerClientIp(H({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" })), "198.51.100.4");
  assert.equal(partnerClientIp(H({ "x-forwarded-for": " 2001:db8::1 " })), "2001:db8::1");
  assert.equal(partnerClientIp(H({})), null);
  assert.equal(partnerClientIp(H({ "x-real-ip": "not an ip<script>" })), null);
  assert.equal(partnerClientIp(H({ "x-forwarded-for": "1.1.1.1, " })), "1.1.1.1");
});

test("agreement: version and a text for every locale, no Hebrew", () => {
  assert.equal(PARTNER_AGREEMENT_VERSION, "2026-11");
  const n = agreementText("en").sections.length;
  for (const l of PARTNER_LOCALES) {
    const a = agreementText(l);
    assert.ok(a.title && a.intro);
    assert.equal(a.sections.length, n, l);
    assert.doesNotMatch(JSON.stringify(a), /[֐-׿]/);
    assert.match(JSON.stringify(a), /30\s?%/);
    assert.match(JSON.stringify(a), /50\s?%/);
  }
});

test("validateProfile: same rules as registration, locked fields refused", () => {
  const good = { firstName: " Anna ", lastName: "Meier", company: "", language: "de" };
  const ctx = { country: "DE" };
  const r = validateProfile(good, ctx);
  assert.ok(r.ok && r.data.firstName === "Anna" && r.data.company === null && r.data.language === "de");
  const code = (x: ReturnType<typeof validateProfile>) => (x.ok ? "ok" : `${x.field}:${x.code}`);
  assert.equal(code(validateProfile({ ...good, firstName: "" }, ctx)), "firstName:err.firstName");
  assert.equal(code(validateProfile({ ...good, lastName: "x".repeat(81) }, ctx)), "lastName:err.lastName");
  assert.equal(code(validateProfile({ ...good, company: "x".repeat(121) }, ctx)), "company:err.company");
  assert.equal(code(validateProfile({ ...good, language: "he" }, ctx)), "language:err.language");
  assert.equal(code(validateProfile({ ...good, phone: "+1 555 0100" }, ctx)), "phone:err.unknownField");
  assert.equal(code(validateProfile({ ...good, partnerId: "x" }, ctx)), "partnerId:err.unknownField");
  assert.equal(code(validateProfile(null, ctx)), "_:err.invalid");
});
