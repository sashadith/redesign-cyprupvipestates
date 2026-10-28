import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maskPhone, formatBudget, parseBudgetInput, buildRegistrationMessage, normalizeProfile,
  isRegistrable, canMark, undoTarget, canResend, REMINDER_AFTER_MS,
} from "@/lib/crm/registration/core";

test("maskPhone: operator example and international formats", () => {
  assert.deepEqual(maskPhone("+35799278285"), { ok: true, masked: "+357XXXX8285" });
  assert.deepEqual(maskPhone("+49 171 234-5678"), { ok: true, masked: "+49XXXX5678" });
  assert.deepEqual(maskPhone("0044 7911 123456"), { ok: true, masked: "+44XXXX3456" });
  assert.deepEqual(maskPhone("+357 (99) 27.82.85"), { ok: true, masked: "+357XXXX8285" });
});
test("maskPhone refuses guesses and fragments", () => {
  for (const bad of [null, "", "99278285", "+357 123", "abc", "+"]) assert.equal(maskPhone(bad).ok, false, String(bad));
  const r = maskPhone("99278285");
  assert.ok(!r.ok && /international format/i.test(r.reason));
});
test("formatBudget", () => {
  assert.equal(formatBudget(300000, 500000), "€300,000 – €500,000");
  assert.equal(formatBudget(null, 500000), "up to €500,000");
  assert.equal(formatBudget(300000, null), "from €300,000");
  assert.equal(formatBudget(null, null), null);
  assert.equal(formatBudget(400000, 400000), "€400,000");
});
test("parseBudgetInput refuses text, negatives and fractions", () => {
  assert.deepEqual(parseBudgetInput(""), { ok: true, value: null });
  assert.deepEqual(parseBudgetInput(null), { ok: true, value: null });
  assert.deepEqual(parseBudgetInput("450000"), { ok: true, value: 450000 });
  assert.deepEqual(parseBudgetInput(450000), { ok: true, value: 450000 });
  for (const bad of ["+35799278285 call me", "-5", "1.5", "4e5", {}, []]) assert.equal(parseBudgetInput(bad).ok, false, String(bad));
});
test("message matches §7.2 and omits empty lines", () => {
  const m = buildRegistrationMessage({ clientName: "Anna Muster", maskedPhone: "+357XXXX8285", projects: ["Vista", "Blue"], budget: "up to €500,000", contactPerson: null, staffName: "Sascha Dith" });
  assert.equal(m.subject, "Client registration – Anna Muster – Cyprus VIP Estates");
  assert.equal(m.text, [
    "Dear Sales Team,", "", "We would like to register the following client with you:", "",
    "Full name: Anna Muster", "Phone: +357XXXX8285", "Preferred project: Vista, Blue", "Budget: up to €500,000", "",
    "Please confirm the registration.", "", "Kind regards,", "Sascha Dith", "Cyprus VIP Estates",
  ].join("\n"));
  const bare = buildRegistrationMessage({ clientName: "A B", maskedPhone: "+44XXXX3456", projects: [], budget: null, contactPerson: "Maria", staffName: "X" });
  assert.match(bare.text, /^Dear Maria,/);
  assert.doesNotMatch(bare.text, /Preferred project|Budget/);
});
test("normalizeProfile", () => {
  const ok = normalizeProfile({ channel: "EMAIL", emailTo: "Sales@Marinakisproperty.com", emailCc: "mvenizelou@marinakisproperty.com, sales@marinakisproperty.com", whatsApp: "" }, "office@cyprusvipestates.com");
  assert.deepEqual(ok, { ok: true, value: { channel: "EMAIL", emailTo: ["sales@marinakisproperty.com"], emailCc: ["mvenizelou@marinakisproperty.com"], whatsApp: [], whatsAppGroupId: null, whatsAppGroupName: null } });
  assert.equal(normalizeProfile({ channel: "EMAIL", emailTo: "", emailCc: "", whatsApp: "" }, "office@x.com").ok, false);
  assert.equal(normalizeProfile({ channel: "EMAIL", emailTo: "not-an-email", emailCc: "", whatsApp: "" }, "office@x.com").ok, false);
  assert.equal(normalizeProfile({ channel: "EMAIL", emailTo: "a@b.com", emailCc: "office@x.com", whatsApp: "" }, "office@x.com").ok, false);
  assert.equal(normalizeProfile({ channel: "BOGUS", emailTo: "a@b.com", emailCc: "", whatsApp: "" }, "office@x.com").ok, false);
  assert.deepEqual(normalizeProfile({ channel: "WHATSAPP", emailTo: "", emailCc: "", whatsApp: "+357 99 278285\n00357 99 111222" }, "o@x.com"),
    { ok: true, value: { channel: "WHATSAPP", emailTo: [], emailCc: [], whatsApp: ["+35799278285", "+35799111222"], whatsAppGroupId: null, whatsAppGroupName: null } });
  assert.equal(normalizeProfile({ channel: "WHATSAPP", emailTo: "", emailCc: "", whatsApp: "99278285" }, "o@x.com").ok, false);
});
test("isRegistrable", () => {
  assert.ok(isRegistrable({ registrationChannel: "EMAIL", registrationEmailTo: ["a@b.com"], registrationWhatsApp: [] }));
  assert.ok(!isRegistrable({ registrationChannel: "EMAIL", registrationEmailTo: [], registrationWhatsApp: ["+357"] }));
  assert.ok(isRegistrable({ registrationChannel: "WHATSAPP", registrationEmailTo: [], registrationWhatsApp: ["+35799278285"] }));
  assert.ok(!isRegistrable({ registrationChannel: "NONE", registrationEmailTo: ["a@b.com"], registrationWhatsApp: ["+357"] }));
});
test("transitions follow §12.7", () => {
  assert.ok(canMark("SENT", "PRELIMINARY") && canMark("SENT", "FIXED") && canMark("PRELIMINARY", "FIXED"));
  assert.ok(canMark("SENT", "REJECTED") && canMark("PRELIMINARY", "REJECTED"));
  assert.ok(!canMark("FAILED", "PRELIMINARY") && !canMark("FIXED", "REJECTED") && !canMark("REJECTED", "PRELIMINARY"));
  assert.equal(undoTarget("PRELIMINARY", true), "SENT");
  assert.equal(undoTarget("FIXED", true), "PRELIMINARY");
  assert.equal(undoTarget("FIXED", false), "SENT");
  assert.equal(undoTarget("REJECTED", true), "PRELIMINARY");
  assert.equal(undoTarget("SENT", false), null);
  assert.ok(canResend("FAILED") && canResend("REJECTED") && !canResend("SENT"));
  assert.equal(REMINDER_AFTER_MS, 172_800_000);
});

test("office@ is refused in To as well as CC", () => {
  assert.equal(normalizeProfile({ channel: "EMAIL", emailTo: "Office@X.com", emailCc: "", whatsApp: "" }, "office@x.com").ok, false);
});

test("normalizeProfile: a WhatsApp group alone is enough; it needs a real group id and a name", () => {
  const g = { channel: "WHATSAPP", emailTo: "", emailCc: "", whatsApp: "" };
  const ok = normalizeProfile({ ...g, whatsAppGroupId: "120363427859674423@g.us", whatsAppGroupName: " Cyprus VIP Estates - Pafilia " }, "office@x.com");
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.value.whatsAppGroupName, "Cyprus VIP Estates - Pafilia");
  assert.equal(normalizeProfile(g, "office@x.com").ok, false);
  assert.equal(normalizeProfile({ ...g, whatsAppGroupId: "35799111222@c.us", whatsAppGroupName: "x" }, "office@x.com").ok, false);
  assert.equal(normalizeProfile({ ...g, whatsAppGroupId: "120363427859674423@g.us", whatsAppGroupName: "" }, "office@x.com").ok, false);
  const cleared = normalizeProfile({ ...g, whatsApp: "+35799111222", whatsAppGroupId: "", whatsAppGroupName: "stale" }, "office@x.com");
  assert.ok(cleared.ok && cleared.value.whatsAppGroupId === null && cleared.value.whatsAppGroupName === null);
});

test("isRegistrable: WhatsApp with only a group", () => {
  assert.equal(isRegistrable({ registrationChannel: "WHATSAPP", registrationEmailTo: [], registrationWhatsApp: [], registrationWhatsAppGroupId: "1203634@g.us" }), true);
  assert.equal(isRegistrable({ registrationChannel: "WHATSAPP", registrationEmailTo: [], registrationWhatsApp: [], registrationWhatsAppGroupId: null }), false);
});
