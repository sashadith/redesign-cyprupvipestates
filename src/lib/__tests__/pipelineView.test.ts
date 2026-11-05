import { test } from "node:test";
import assert from "node:assert/strict";
import { clientClock, waMeLink, weekRange } from "@/lib/partner/pipeline/view";
import { editRawFromForm, inPartnerDateWindow, parseWholeEuros, portalDateTime, wholeEuros } from "@/lib/partner/pipeline/forms";
import { isoWeek, weekLabel } from "@/lib/crm/leadLocalTime";
import { validateLeadEdit } from "@/lib/crm/editLead";

test("weekRange gives the Cyprus ISO week with its Monday and Friday", () => {
  const r = weekRange(new Date("2026-11-05T10:00:00Z")); // Thursday
  assert.equal(r.week, 45);
  assert.equal(r.monday.toISOString().slice(0, 10), "2026-11-02");
  assert.equal(r.friday.toISOString().slice(0, 10), "2026-11-06");
  // 23:30 UTC Sunday is already Monday in Cyprus.
  assert.equal(weekRange(new Date("2026-11-08T23:30:00Z")).week, 46);
});

test("clientClock formats the lead's time in the partner's language", () => {
  const c = clientClock("Europe/London", new Date("2026-11-05T10:05:00Z"), "de");
  assert.equal(c.time, "10:05");
  assert.equal(c.city, "London");
  assert.match(c.weekday, /^Do/);
});

test("waMeLink puts an international number in the link and falls back to picking the chat", () => {
  assert.equal(waMeLink("+44 7700 900123", "Hi & link"), "https://wa.me/447700900123?text=Hi%20%26%20link");
  assert.equal(waMeLink("0049 151 1234567", "x"), "https://wa.me/491511234567?text=x");
  assert.equal(waMeLink("07700 900123", "x"), "https://wa.me/?text=x");
  assert.equal(waMeLink(null, "x"), "https://wa.me/?text=x");
});

test("portalDateTime reads Cyprus wall time", () => {
  assert.equal(portalDateTime("2026-11-05T10:00")!.toISOString(), "2026-11-05T08:00:00.000Z");
  assert.equal(portalDateTime("2026-07-05T10:00")!.toISOString(), "2026-07-05T07:00:00.000Z");
  assert.equal(portalDateTime(""), null);
  assert.equal(portalDateTime("tomorrow"), null);
});

test("wholeEuros accepts plain or thousands-grouped whole numbers and refuses everything else", () => {
  for (const [s, n] of [["350000", 350000], ["350 000", 350000], ["350.000", 350000], ["350,000", 350000], ["1.250.000", 1250000], ["350\u00a0000 €", 350000], ["€ 350,000", 350000]] as const) {
    assert.equal(wholeEuros(s), n, s);
    assert.equal(parseWholeEuros(s), n, s);
  }
  for (const s of ["350000.00", "1.5", "1,5", "12.34.5", "1.250,000", "35,00", "abc", ""]) {
    assert.ok(Number.isNaN(wholeEuros(s)), s);
    assert.equal(parseWholeEuros(s), null, s);
  }
});

test("inPartnerDateWindow: from a day back to 730 days ahead", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  const day = 86_400_000;
  assert.ok(inPartnerDateWindow(new Date(now.getTime() - day + 1000), now));
  assert.ok(!inPartnerDateWindow(new Date(now.getTime() - day - 1000), now));
  assert.ok(inPartnerDateWindow(new Date(now.getTime() + 730 * day), now));
  assert.ok(!inPartnerDateWindow(new Date(now.getTime() + 731 * day), now));
});

test("isoWeek agrees with weekLabel", () => {
  for (const iso of ["2026-11-05T10:00:00Z", "2026-12-31T12:00:00Z", "2027-01-01T12:00:00Z", "2026-11-08T23:30:00Z"]) {
    const at = new Date(iso);
    assert.ok(weekLabel(at).startsWith(`KW ${isoWeek(at).week} (`), iso);
  }
});

test("editRawFromForm builds what validateLeadEdit takes, without notes", () => {
  const fd = new Map<string, string>([["firstName", " Anna "], ["email", "anna@x.test"], ["budgetMin", "200 000"], ["budgetMax", ""], ["languagePreference", "de"], ["notes", "x"]]);
  const raw = editRawFromForm((k) => fd.get(k) ?? null);
  assert.equal(raw.firstName, "Anna");
  assert.equal(raw.budgetMin, 200000);
  assert.equal(raw.budgetMax, null);
  assert.equal(raw.salutation, "UNKNOWN");
  assert.ok(!("notes" in raw));
  const v = validateLeadEdit({ ...raw, notes: null }, null);
  assert.ok(v.ok, JSON.stringify(v));
  assert.equal(editRawFromForm((k) => (k === "budgetMax" ? "1.5" : null)).budgetMax, "1.5"); // refused by validateLeadEdit, not guessed
  const bad = validateLeadEdit({ ...editRawFromForm((k) => (k === "firstName" ? "A" : k === "phone" ? "+357 99 123456" : k === "budgetMin" ? "lots" : null)), notes: null }, null);
  assert.deepEqual(bad.ok ? null : [bad.error, bad.field], ["Budget must be a whole number, 0 or more.", "budgetMin"]);
});
