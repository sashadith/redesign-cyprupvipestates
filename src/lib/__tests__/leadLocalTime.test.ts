import { test } from "node:test";
import assert from "node:assert/strict";
import { callLight, followUpLeadTime, leadTimeSummary, leadZone, parseCallWindow, weekLabel } from "@/lib/crm/leadLocalTime";

const W = parseCallWindow();

test("zone: a hand-picked zone wins, then the form country, then the phone's calling code", () => {
  assert.deepEqual(leadZone({ timeZone: "America/Chicago", countryOfResidence: "US" }), { zone: "America/Chicago", source: "lead", country: "United States" });
  assert.deepEqual(leadZone({ countryOfResidence: "SE", phone: "+27 82 555 1234" }), { zone: "Europe/Stockholm", source: "country", country: "Sweden" });
  assert.deepEqual(leadZone({ countryOfResidence: null, phone: "+46 70 123 4567" }), { zone: "Europe/Stockholm", source: "phone", country: "Sweden" });
  assert.equal(leadZone({ phone: "+27 82 555 1234" }).zone, "Africa/Johannesburg");
  assert.equal(leadZone({ phone: "+44 7700 900123" }).zone, "Europe/London");
  assert.equal(leadZone({ countryOfResidence: "CY" }).zone, "Asia/Nicosia");
  assert.equal(leadZone({ countryOfResidence: "ES" }).zone, "Europe/Madrid"); // Canaries only by hand
  assert.equal(leadZone({ phone: "+34 649 821 400" }).zone, "Europe/Madrid");
  assert.equal(leadZone({ timeZone: "Not/AZone", countryOfResidence: "GB" }).zone, "Europe/London");
});

test("countries with several zones, and +1 numbers, are 'zone unclear' with the options to pick from", () => {
  const ca = leadZone({ countryOfResidence: "CA" });
  assert.equal(ca.zone, null);
  assert.ok(ca.zone === null && ca.reason === "ambiguous" && ca.options.includes("America/Toronto"));
  const plus1 = leadZone({ phone: "+1 416 555 0100" });
  assert.ok(plus1.zone === null && plus1.reason === "ambiguous" && plus1.options.includes("America/Vancouver") && plus1.options.includes("America/New_York"));
  assert.deepEqual(leadZone({ phone: "0170 1234567" }), { zone: null, reason: "unknown" });
});

test("summer and winter time come from the IANA zone, not a fixed offset", () => {
  // 08:30 UTC: London is 09:30 in summer (BST) but 08:30 in winter.
  assert.equal(leadTimeSummary({ countryOfResidence: "GB" }, new Date("2026-07-01T08:30:00Z"), W).text, "Wed 09:30 in London (good time to call)");
  assert.equal(leadTimeSummary({ countryOfResidence: "GB" }, new Date("2026-11-04T08:30:00Z"), W).text, "Wed 08:30 in London (borderline time to call)");
});

test("call light: green 09-20 on workdays, amber 08-09 and 20-21, red otherwise and on weekends; bounds are configurable", () => {
  const z = "Europe/Berlin"; // UTC+1 in November
  assert.equal(callLight(new Date("2026-11-04T09:00:00Z"), z, W), "green"); // Wed 10:00
  assert.equal(callLight(new Date("2026-11-04T07:30:00Z"), z, W), "amber"); // Wed 08:30
  assert.equal(callLight(new Date("2026-11-04T19:30:00Z"), z, W), "amber"); // Wed 20:30
  assert.equal(callLight(new Date("2026-11-04T21:00:00Z"), z, W), "red"); // Wed 22:00
  assert.equal(callLight(new Date("2026-11-07T10:00:00Z"), z, W), "red"); // Sat 11:00
  const custom = parseCallWindow({ green: "10:00-18:00", amber: "09:00-10:00", workdays: "1-6" });
  assert.equal(callLight(new Date("2026-11-04T08:30:00Z"), z, custom), "amber"); // Wed 09:30
  assert.equal(callLight(new Date("2026-11-07T10:00:00Z"), z, custom), "green"); // Sat 11:00 is a workday now
  assert.deepEqual(parseCallWindow({ green: "nonsense" }).green, parseCallWindow().green);
});

test("follow-ups read as an ISO calendar week and on the lead's clock", () => {
  assert.equal(weekLabel(new Date("2026-11-04T07:00:00Z")), "KW 45 (02 - 06 Nov)");
  assert.equal(weekLabel(new Date("2026-12-01T07:00:00Z")), "KW 49 (30 Nov - 04 Dec)");
  assert.equal(weekLabel(new Date("2027-01-01T07:00:00Z")), "KW 53 (28 Dec - 01 Jan)");
  assert.equal(followUpLeadTime(new Date("2026-11-05T07:00:00Z"), "Europe/London"), "07:00 Thu in London");
});

test("reminder and new-lead alert lines carry the lead's clock and the follow-up week", async () => {
  const { nagLocalLine } = await import("@/lib/crm/leadNag");
  const { buildInboundLeadTelegramMessage } = await import("@/lib/leadNotify");
  const line = nagLocalLine(
    { id: "x", firstName: "A", lastName: "B", status: "CONTACTED", lastContactAt: null, createdAt: new Date(), nextFollowUpAt: new Date("2026-11-05T07:00:00Z"), viewingScheduledAt: null, lastStatusChangeAt: null, assignedToId: null, countryOfResidence: "ZA" },
    new Date("2026-11-04T08:00:00Z"), W,
  );
  assert.equal(line, "Wed 10:00 in Johannesburg (good time to call) · follow-up KW 45 (02 - 06 Nov), 09:00 Thu in Johannesburg");
  const msg = buildInboundLeadTelegramMessage({ leadId: "x", source: "CONTACT_FORM", link: "https://e/x", localTime: "Local time: Wed 10:00 in Johannesburg (good time to call)", hints: ["Landline number"] });
  assert.match(msg, /🕐 Local time: Wed 10:00 in Johannesburg \(good time to call\)\n⚠️ Landline number\n/);
});
