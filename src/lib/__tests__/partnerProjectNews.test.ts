import { test } from "node:test";
import assert from "node:assert/strict";
import { bedPrices, clientFits, newsPlace, shortBlurb, type NewsClient } from "@/lib/partner/newsFacts";
import { bedroomLabel, buildProjectNewsEmail, projectNewsLines } from "@/lib/partner/notify";
import { TELEGRAM_NEWS_CHUNK, buildTelegramNotification, buildTelegramProjectNews } from "@/lib/partner/telegram";
import { buildDigestTelegram } from "@/lib/partner/digest";
import { buildVerifyEmail, renderPartnerEmail, PARTNER_WHATSAPP_URL } from "@/lib/partner/mail";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";
import type { NewsItem } from "@/lib/partner/alerts";

const url = "https://cyprusvipestates.com/projects/athina-residences";
const athina: NewsItem = {
  name: "Athina Residences", area: "Limassol – Erimi", priceFrom: 180_000, url, rate: 5,
  type: "Apartment", beds: [{ beds: 1, price: 180_000 }, { beds: 2, price: 295_000 }],
  blurb: { en: "Sea views, 300 m to the beach.", de: "Meerblick, 300 m zum Strand." }, clients: ["Katerin Test", "Sascha Test"],
};

// ── Facts ───────────────────────────────────────────────────────────────────

test("bedPrices: cheapest AVAILABLE price per bedroom count, studio = 0, ascending", () => {
  assert.deepEqual(bedPrices([
    { status: "available", beds: "2", type: "Apartment", price: 310_000 },
    { status: "available", beds: "2 Bedroom", type: "Apartment", price: 295_000 },
    { status: "sold", beds: "1", type: "Apartment", price: 100_000 },
    { status: "available", beds: "1", type: "Apartment", price: 180_000 },
    { status: "available", beds: "Studio", type: "Studio", price: 120_000 },
    { status: "available", beds: "3", type: "Apartment", price: 0 },
    { status: "available", beds: "", type: "Apartment", price: 99_000 },
  ]), [{ beds: 0, price: 120_000 }, { beds: 1, price: 180_000 }, { beds: 2, price: 295_000 }]);
});

test("newsPlace: town and area once each", () => {
  assert.equal(newsPlace("Limassol", "Erimi"), "Limassol – Erimi");
  assert.equal(newsPlace("Paphos", "paphos"), "Paphos");
  assert.equal(newsPlace(null, " Erimi "), "Erimi");
  assert.equal(newsPlace(null, null), null);
  assert.equal(newsPlace(null, "Erimi", "Limassol"), "Limassol – Erimi", "no town → the district");
  assert.equal(newsPlace("Paphos", "Kato Paphos", "Paphos"), "Paphos – Kato Paphos");
});

test("shortBlurb: first sentence, a second while it fits, numbers never split, long text cut at a word", () => {
  const de = "Eine geschlossene Wohnanlage in Germasogeia, Limassol. Das Gebäude hat vier Geschosse. Baubeginn ist November 2026, die Übergabe ist für Mai 2029 vorgesehen und alles läuft nach Plan.";
  assert.equal(shortBlurb(de, 100), "Eine geschlossene Wohnanlage in Germasogeia, Limassol. Das Gebäude hat vier Geschosse.");
  assert.equal(shortBlurb("Grundstücke von 410 bis 1.167 m². Rest des Satzes.", 40), "Grundstücke von 410 bis 1.167 m².");
  assert.equal(shortBlurb("Дом у моря. Второе предложение здесь.", 12), "Дом у моря.");
  const long = shortBlurb("word ".repeat(80), 60)!;
  assert.ok(long.length <= 60 && long.endsWith("…") && !long.includes("wor…"));
  assert.equal(shortBlurb("First paragraph.\n\nSecond paragraph."), "First paragraph.");
  assert.equal(shortBlurb("  "), null);
  assert.equal(shortBlurb(null), null);
});

const dev = (o: Partial<Parameters<typeof clientFits>[0]> = {}): Parameters<typeof clientFits>[0] => ({
  district: "Limassol", town: "Limassol", area: "Erimi", priceFrom: 180_000, category: "Apartment",
  units: [{ status: "available", beds: "1", type: "Apartment", price: 180_000 }, { status: "available", beds: "2", type: "Apartment", price: 295_000 }],
  ...o,
});
const client = (o: Partial<NewsClient> = {}): NewsClient => ({
  name: "Katerin", budgetMin: null, budgetMax: null, propertyTypeInterest: [], lastMatchFilters: null, projectDistricts: [], ...o,
});

test("clientFits: budget (+10 %), the chosen projects' district, and no claim without a criterion", () => {
  assert.equal(clientFits(dev(), client({ budgetMax: 200_000 })), true);
  assert.equal(clientFits(dev(), client({ budgetMax: 165_000 })), true, "180k is inside 165k + 10 %");
  assert.equal(clientFits(dev(), client({ budgetMax: 150_000 })), false);
  assert.equal(clientFits(dev(), client({ budgetMax: 400_000, projectDistricts: ["Paphos"] })), false, "client chose Paphos projects");
  assert.equal(clientFits(dev(), client({ budgetMax: 400_000, projectDistricts: ["Limassol"] })), true);
  assert.equal(clientFits(dev(), client()), false, "nothing known → no fit");
  // Our advisor's saved search wins over the chosen projects' districts.
  assert.equal(clientFits(dev(), client({ projectDistricts: ["Paphos"], lastMatchFilters: { districts: ["Limassol"], bedrooms: [2] } })), true);
  assert.equal(clientFits(dev(), client({ lastMatchFilters: { bedrooms: [4] } })), false);
});

test("clientFits: a project without unit rows is tested at its headline price; sold out fits nobody", () => {
  assert.equal(clientFits(dev({ units: [] }), client({ budgetMax: 200_000 })), true);
  assert.equal(clientFits(dev({ units: [], priceFrom: null }), client({ budgetMax: 200_000 })), false);
  assert.equal(clientFits(dev({ units: [{ status: "sold", beds: "1", type: "Apartment", price: 180_000 }] }), client({ budgetMax: 200_000 })), false);
});

// ── Copy ────────────────────────────────────────────────────────────────────

test("bedroomLabel: plural forms per locale", () => {
  assert.equal(bedroomLabel("en", 1), "1 bedroom");
  assert.equal(bedroomLabel("en", 2), "2 bedrooms");
  assert.equal(bedroomLabel("pl", 2), "2 sypialnie");
  assert.equal(bedroomLabel("pl", 5), "5 sypialni");
  assert.equal(bedroomLabel("ru", 1), "1 спальня");
  assert.equal(bedroomLabel("ru", 3), "3 спальни");
  assert.equal(bedroomLabel("ru", 5), "5 спален");
  for (const l of PARTNER_LOCALES) assert.ok(bedroomLabel(l, 0).trim());
});

test("projectNewsLines: type and place, prices per bedroom count, selling line, rate, fitting clients", () => {
  const en = projectNewsLines("en", athina);
  assert.equal(en[0], "Apartment — Limassol – Erimi");
  assert.ok(en.includes("1 bedroom from €180,000"));
  assert.ok(en.includes("2 bedrooms from €295,000"));
  assert.ok(en.includes("Sea views, 300 m to the beach."));
  assert.ok(en.includes("Fits your clients: Katerin Test, Sascha Test"));
  assert.ok(en.some((l) => l.startsWith("Your rate")));
  const de = projectNewsLines("de", athina);
  assert.ok(de.includes("Meerblick, 300 m zum Strand."));
  assert.ok(de.some((l) => l.startsWith("2 Schlafzimmer ab")));
  assert.ok(projectNewsLines("pl", athina).includes("Sea views, 300 m to the beach."), "no PL text → the EN one");
  const bare = projectNewsLines("en", { ...athina, beds: [], blurb: {}, clients: [], rate: null, type: null });
  assert.deepEqual(bare, ["Limassol – Erimi", "Price from €180,000"], "no fits line when nobody fits");
});

test("project news e-mail: linked names in HTML, every project listed, footer with links", () => {
  const projects = Array.from({ length: 9 }, (_, i) => ({ ...athina, name: `P${i}`, url: `${url}-${i}` }));
  const mail = buildProjectNewsEmail("en", { partnerFirstName: "Eva", projects, link: "https://p/projects" });
  for (let i = 0; i < 9; i++) assert.ok(mail.html.includes(`href="${url}-${i}"`) && mail.text.includes(`P${i}`));
  assert.ok(mail.html.includes(PARTNER_WHATSAPP_URL));
  assert.ok(mail.html.includes("Stronger together"));
  assert.ok(mail.text.includes("/profile#settings"));
});

test("footer: every locale has it; verify/reset carry the tagline only", () => {
  for (const l of PARTNER_LOCALES) {
    const f = dict(l).mail.footer;
    for (const v of Object.values(f)) assert.ok(v.trim(), `${l} footer`);
  }
  const verify = buildVerifyEmail("de", "https://p/verify?t=x", "Eva");
  assert.ok(verify.text.includes("Gemeinsam stärker"));
  assert.ok(!verify.text.includes(PARTNER_WHATSAPP_URL) && !verify.text.includes("#settings"));
  const plain = renderPartnerEmail({ subject: "s", greeting: null, intro: "i", button: "b", link: "https://x", notes: [], signature: "sig" });
  assert.ok(!plain.html.includes("Stronger together"), "no footer unless asked for");
});

test("footer HTML escapes its values", () => {
  const m = renderPartnerEmail({
    subject: "s", greeting: null, intro: "i", button: "b", link: "https://x", notes: [], signature: "sig",
    items: [{ title: "<b>x</b>", href: "https://y/\"q", lines: ["a<b"] }],
    footer: { tagline: "t<i>", links: [{ label: "l&", href: "https://z" }], settings: null },
  });
  assert.ok(!m.html.includes("<b>x</b>") && m.html.includes("&lt;b&gt;x") && m.html.includes("a&lt;b") && m.html.includes("t&lt;i&gt;") && m.html.includes("l&amp;"));
});

// ── Telegram ────────────────────────────────────────────────────────────────

test("Telegram project news: linked names, every project, split under the limit, tagline last", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ name: `Project ${i}`, url: `${url}-${i}`, lines: projectNewsLines("en", athina) }));
  const msgs = buildTelegramProjectNews("en", items, "https://p/projects");
  assert.ok(msgs.length > 1, "40 projects do not fit one message");
  for (const m of msgs) assert.ok(m.length <= TELEGRAM_NEWS_CHUNK);
  const all = msgs.join("\n");
  for (let i = 0; i < 40; i++) assert.ok(all.includes(`<a href="${url}-${i}">Project ${i}</a>`));
  assert.ok(msgs[0].startsWith("<b>Fresh on the market"));
  assert.ok(msgs[msgs.length - 1].endsWith("<i>Stronger together 🤝</i>"));
  const one = buildTelegramProjectNews("de", [{ name: "A & B", url, lines: ["x<y"] }], "https://p/projects");
  assert.equal(one.length, 1);
  assert.ok(one[0].includes("A &amp; B") && one[0].includes("x&lt;y") && one[0].includes("Gemeinsam stärker"));
});

test("Telegram: every notification and the weekly summary close with the tagline", () => {
  for (const l of PARTNER_LOCALES) {
    const tag = dict(l).mail.footer.tagline;
    assert.ok(buildTelegramNotification(l, { kind: "TIER_NEAR", tierName: "Gold", url: "https://p", portalUrl: "https://p" }).endsWith(`<i>${tag}</i>`));
    const digest = buildDigestTelegram(l, {
      content: { updates: [], totals: { expected: 0, earned: 0, developerPaid: 0, paidOut: 0 }, newProjects: [{ name: "Sea", town: "Paphos", url, handoverRate: 2 }] } as never,
      portalUrl: "https://p",
    });
    assert.ok(digest.endsWith(`<i>${tag}</i>`));
  }
});
