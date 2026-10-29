import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths, firstTermEnd, currentTermEnd, contractStatus, currentContract, dueReminder,
  nicosiaToday, parseContractFields, looksLikePdf, whenText, isIsoDate,
} from "../developerContract";

const c = (signedAt: string, termMonths: number, autoRenew = false) => ({ signedAt, termMonths, autoRenew });
const unsent = { reminder14SentAt: null, reminder1SentAt: null };

test("a term ends the day before its anniversary", () => {
  assert.equal(firstTermEnd("2026-01-01", 12), "2026-12-31");
  assert.equal(firstTermEnd("2026-03-15", 6), "2026-09-14");
  assert.equal(firstTermEnd("2026-10-29", 1), "2026-11-28");
});

test("a month without the signing day clamps to its last day", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
});

test("auto-renewal rolls on by the term, counted from the signing date", () => {
  const x = c("2025-01-31", 1, true);
  assert.equal(currentTermEnd(x, "2025-02-10"), "2025-02-27");
  // Periods are measured from 31 Jan each time, so March is not shortened by February.
  assert.equal(currentTermEnd(x, "2025-03-01"), "2025-03-30");
  assert.equal(currentTermEnd(c("2024-06-01", 12, true), "2026-10-29"), "2027-05-31");
  // On the last day of a period it is still that period.
  assert.equal(currentTermEnd(c("2025-01-01", 12, true), "2025-12-31"), "2025-12-31");
});

test("status: active, ending within 14 days, expired, auto-renewing, none", () => {
  assert.equal(contractStatus(null, "2026-10-29").kind, "none");
  assert.deepEqual(contractStatus(c("2026-01-01", 12), "2026-12-01"), { kind: "active", endDate: "2026-12-31", daysLeft: 30 });
  assert.deepEqual(contractStatus(c("2026-01-01", 12), "2026-12-17"), { kind: "expiring", endDate: "2026-12-31", daysLeft: 14 });
  assert.equal(contractStatus(c("2026-01-01", 12), "2026-12-16").kind, "active");
  assert.deepEqual(contractStatus(c("2026-01-01", 12), "2026-12-31"), { kind: "expiring", endDate: "2026-12-31", daysLeft: 0 });
  assert.deepEqual(contractStatus(c("2026-01-01", 12), "2027-01-01"), { kind: "expired", endDate: "2026-12-31", daysLeft: -1 });
  assert.deepEqual(contractStatus(c("2026-01-01", 12, true), "2027-01-01"), { kind: "autoRenew", endDate: "2027-12-31", daysLeft: 364 });
});

test("the current contract is the one signed last, then the one entered last", () => {
  const rows = [
    { id: "a", signedAt: new Date("2024-01-01T00:00:00Z"), createdAt: new Date("2026-10-29T10:00:00Z") },
    { id: "b", signedAt: new Date("2026-01-01T00:00:00Z"), createdAt: new Date("2026-01-02T10:00:00Z") },
    { id: "c", signedAt: new Date("2025-06-01T00:00:00Z"), createdAt: new Date("2026-10-29T11:00:00Z") },
  ];
  assert.equal(currentContract(rows)?.id, "b");
  const sameDay = [
    { id: "old", signedAt: "2026-01-01", createdAt: "2026-01-01T09:00:00Z" },
    { id: "addendum", signedAt: "2026-01-01", createdAt: "2026-02-01T09:00:00Z" },
  ];
  assert.equal(currentContract(sameDay)?.id, "addendum");
  assert.equal(currentContract([]), null);
});

test("reminders: 14 days before, then 1 day before, each once", () => {
  const x = { ...c("2026-01-01", 12), ...unsent }; // ends 2026-12-31
  assert.equal(dueReminder(x, "2026-12-16"), null);
  assert.equal(dueReminder(x, "2026-12-17"), 14);
  assert.equal(dueReminder({ ...x, reminder14SentAt: new Date() }, "2026-12-20"), null);
  assert.equal(dueReminder({ ...x, reminder14SentAt: new Date() }, "2026-12-30"), 1);
  assert.equal(dueReminder({ ...x, reminder14SentAt: new Date(), reminder1SentAt: new Date() }, "2026-12-31"), null);
});

test("a missed stage is caught up; a late entry gets the 1-day message only", () => {
  const x = { ...c("2026-01-01", 12), ...unsent };
  assert.equal(dueReminder(x, "2026-12-26"), 14); // entered 5 days before the end
  assert.equal(dueReminder(x, "2026-12-31"), 1); // entered on the last day
  assert.equal(dueReminder(x, "2027-01-07"), 1); // entered within a week after it ended: one "ended" message
  assert.equal(dueReminder(x, "2027-01-08"), null); // older than that: the Action Center item is enough
});

test("an auto-renewing contract never reminds", () => {
  assert.equal(dueReminder({ ...c("2026-01-01", 12, true), ...unsent }, "2026-12-30"), null);
});

test("today is the Nicosia date", () => {
  // 22:30 UTC on 29 Oct is already 30 Oct in Nicosia (UTC+2 in winter).
  assert.equal(nicosiaToday(new Date("2026-10-29T22:30:00Z")), "2026-10-30");
  assert.equal(nicosiaToday(new Date("2026-10-29T05:00:00Z")), "2026-10-29");
});

test("form fields are validated", () => {
  const ok = parseContractFields({ signedAt: "2026-10-01", termMonths: "12", autoRenew: "on", commissionPercent: "5,5 %", note: "  " });
  assert.deepEqual(ok, { ok: true, value: { signedAt: "2026-10-01", termMonths: 12, autoRenew: true, commissionPercent: 5.5, note: null } });
  assert.equal(parseContractFields({ signedAt: "2026-02-30", termMonths: "12" }).ok, false);
  assert.equal(parseContractFields({ signedAt: "", termMonths: "12" }).ok, false);
  assert.equal(parseContractFields({ signedAt: "2026-10-01", termMonths: "0" }).ok, false);
  assert.equal(parseContractFields({ signedAt: "2026-10-01", termMonths: "1.5" }).ok, false);
  assert.equal(parseContractFields({ signedAt: "2026-10-01", termMonths: "12", commissionPercent: "120" }).ok, false);
  const plain = parseContractFields({ signedAt: "2026-10-01", termMonths: "24" });
  assert.ok(plain.ok && plain.value.autoRenew === false && plain.value.commissionPercent === null);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
});

test("only a real PDF header passes", () => {
  assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n...")), true);
  assert.equal(looksLikePdf(new TextEncoder().encode("<html>%PDF-")), false);
  assert.equal(looksLikePdf(new Uint8Array([0x25, 0x50])), false);
});

test("reminder wording", () => {
  assert.equal(whenText(14), "ends in 14 days");
  assert.equal(whenText(1), "ends tomorrow");
  assert.equal(whenText(0), "ends today");
  assert.equal(whenText(-3), "ended 3 days ago");
});
