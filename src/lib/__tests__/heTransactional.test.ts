// WP7 fix round 1 — the non-e-mail Hebrew fixes on the transactional
// surfaces: date prepositions (Pass B M6/M7), the year plural (M11), the
// Entscheidung E carriers (M3/M4/M5), the feminine unit statuses (M12) and
// the two budget labels that must NOT be the same word (M14).
//
// Pure copy tables and pure functions only — nothing here touches the DB,
// the CRM or a mail transport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HE_LANGUAGE_NOTE, hePrefixDate, ltrIsolate } from "@/lib/locale";
import { heYears } from "@/app/components/roi-calculator/RoiResults.copy";
import { COPY as PRESENTATION_COPY } from "@/app/c/[token]/copy";
import { COPY as BOOKING_COPY } from "@/app/book/[token]/copy";
import { BOOKING_CONFIRMATION_EMAIL } from "@/lib/crm/bookingMessages";
import { MODAL_BROCHURE_COPY } from "@/app/components/ModalBrochure/ModalBrochure.copy";

// What `formatInZone(…, "he-IL")` actually produces for a Cyprus slot.
const HE_SLOT = "יום ד׳, 14 באוק׳, 15:00";

test("hePrefixDate glues the prefix to a Hebrew date and hyphenates a numeric one", () => {
  assert.equal(hePrefixDate("ב", HE_SLOT), `ב${HE_SLOT}`);
  assert.equal(hePrefixDate("ל", HE_SLOT), `ל${HE_SLOT}`);
  assert.doesNotMatch(hePrefixDate("ב", HE_SLOT), /ב-/);
  assert.equal(hePrefixDate("ב", "14/10/2026"), `ב-${ltrIsolate("14/10/2026")}`);
  assert.equal(hePrefixDate("ל", "Wed 14 Oct"), `ל-${ltrIsolate("Wed 14 Oct")}`);
});

test("no shipped Hebrew string glues a hyphen onto a Hebrew Intl date", () => {
  const booking = BOOKING_COPY.he.confirmedBody(HE_SLOT);
  const mail = BOOKING_CONFIRMATION_EMAIL.he("Yossi", HE_SLOT, "ZOOM").body;
  for (const s of [booking, mail]) {
    assert.doesNotMatch(s, /[בל]-יום/, `hyphen before a Hebrew weekday: ${s}`);
  }
  assert.match(booking, /נפגשים ביום ד׳/);
  assert.match(mail, /מאושרת ליום ד׳/);
});

test("heYears uses the singular, the dual and the plural", () => {
  assert.equal(heYears(1), "שנה אחת");
  assert.equal(heYears(2), "שנתיים");
  assert.equal(heYears(3), "3 שנים");
  assert.equal(heYears(11), "11 שנים");
  // Never the ungrammatical forms the plain `${n} ${yearsText}` produced.
  assert.notEqual(heYears(1), "1 שנים");
  assert.notEqual(heYears(2), "2 שנים");
});

test("Entscheidung E reaches every automated Hebrew surface, word for word", () => {
  assert.ok(BOOKING_COPY.he.intro.endsWith(HE_LANGUAGE_NOTE));
  assert.ok(PRESENTATION_COPY.he.closingTrust.endsWith(HE_LANGUAGE_NOTE));
  // …and never leaks into a locale whose consultation happens in that language.
  for (const l of ["en", "de", "pl", "ru"] as const) {
    assert.doesNotMatch(BOOKING_COPY[l].intro, /ברוסית/);
    assert.doesNotMatch(PRESENTATION_COPY[l].closingTrust, /ברוסית/);
  }
});

test("unit statuses agree with the feminine יחידה the column header names", () => {
  const s = PRESENTATION_COPY.he.statusLabel;
  assert.equal(s.available, "זמינה");
  assert.equal(s.reserved, "שמורה");
  assert.equal(s.sold, "נמכרה");
  assert.equal(s.unlisted, "לא זמינה עוד");
  // The project-level badge stays masculine — its subject is the פרויקט.
  assert.equal(PRESENTATION_COPY.he.soldOut, "נמכר");
});

test("the budget floor and the card price caption are different Hebrew words", () => {
  assert.equal(PRESENTATION_COPY.he.budgetFrom, "מעל");
  assert.equal(PRESENTATION_COPY.he.priceFrom, "מחיר התחלתי");
  assert.notEqual(PRESENTATION_COPY.he.budgetFrom, PRESENTATION_COPY.he.priceFrom);
  // Every LTR locale keeps one word for both, exactly as before.
  for (const l of ["en", "de", "pl", "ru"] as const) {
    assert.equal(PRESENTATION_COPY[l].budgetFrom, PRESENTATION_COPY[l].priceFrom);
  }
});

test("the brochure modal has Hebrew copy and the gold accent is the last word", () => {
  const he = MODAL_BROCHURE_COPY.he;
  assert.equal(he.title, "לדבר עם");
  assert.equal(he.accent, "יועץ");
  assert.notEqual(he.title, MODAL_BROCHURE_COPY.en.title);
  assert.doesNotMatch(he.lead, /[—–]/);
  // The LTR rows are the ones the component carried inline before the move.
  assert.equal(MODAL_BROCHURE_COPY.en.title, "Speak to an");
  assert.equal(MODAL_BROCHURE_COPY.de.accent, "Berater");
});

test("no `he` transactional string carries a dash or an exclamation mark", () => {
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") strings.push(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(PRESENTATION_COPY.he);
  walk(BOOKING_COPY.he);
  walk(MODAL_BROCHURE_COPY.he);
  strings.push(BOOKING_COPY.he.confirmedBody(HE_SLOT));
  for (const s of strings) {
    assert.doesNotMatch(s, /[—–!]/, `banned punctuation in: ${s}`);
  }
});
