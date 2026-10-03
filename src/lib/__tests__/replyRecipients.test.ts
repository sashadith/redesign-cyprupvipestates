import { test } from "node:test";
import assert from "node:assert/strict";
import { replyAllRecipients, MAX_STORED_REPLY_RECIPIENTS } from "@/lib/emailInbound/replyRecipients";
import { replyAllDefault, MAX_CC } from "@/lib/mcp/drafts/ccRecipients";
import { shapeInteraction } from "@/lib/mcp/leadDetail";
import { canonicalizeEmail } from "@/lib/emailInbound/matchLead";

/* 2026-10-02: a lead answers with their partner in CC — the reply drafted
   through the connector keeps the partner in copy ("reply all"). */

const addr = (...a: string[]) => ({ value: a.map((address) => ({ address })) });
const OP = "sascha@cyprusvipestates.com";
const LEAD = "client@example.com";

test("lead replies to us with the partner in CC → the partner is kept", () => {
  assert.deepEqual(replyAllRecipients({ from: addr(LEAD), to: addr(OP), cc: addr("partner@alfitouri.com") }, [OP, LEAD]), ["partner@alfitouri.com"]);
});

test("the partner writes, the lead in CC → the partner is kept (reply goes to the lead, partner in copy)", () => {
  assert.deepEqual(replyAllRecipients({ from: addr("partner@alfitouri.com"), to: addr(OP), cc: addr(LEAD) }, [OP, LEAD]), ["partner@alfitouri.com"]);
});

test("other To addresses count too; operator and lead never; duplicates once", () => {
  const r = replyAllRecipients({ from: addr(LEAD), to: addr(OP, "wife@example.com"), cc: addr("Partner@Alfitouri.com", "partner@alfitouri.com", "CLIENT@example.com") }, [OP, LEAD]);
  assert.deepEqual(r, ["wife@example.com", "Partner@Alfitouri.com"]);
});

test("the operator is recognised through Gmail canonicalisation", () => {
  const r = replyAllRecipients({ from: addr(LEAD), to: addr("s.ascha@gmail.com"), cc: addr("p@x.com") }, ["sascha@gmail.com", LEAD], canonicalizeEmail);
  assert.deepEqual(r, ["p@x.com"]);
});

test("array-shaped address fields (mailparser can return several) and junk are handled", () => {
  const r = replyAllRecipients({ from: addr(LEAD), to: [addr(OP), addr("a@x.com")], cc: [addr("not an address"), { value: [{ address: null }] }] }, [OP, LEAD]);
  assert.deepEqual(r, ["a@x.com"]);
  assert.deepEqual(replyAllRecipients({}, [OP]), []);
});

test(`at most ${MAX_STORED_REPLY_RECIPIENTS} stored`, () => {
  const many = Array.from({ length: 15 }, (_, i) => `p${i}@x.com`);
  assert.equal(replyAllRecipients({ cc: addr(...many) }, [OP]).length, MAX_STORED_REPLY_RECIPIENTS);
});

test("draft default: lead and operator dropped, junk dropped, capped at the CC limit", () => {
  assert.deepEqual(replyAllDefault(["partner@alfitouri.com", "CLIENT@example.com", OP, 42, "bad"], LEAD, OP), ["partner@alfitouri.com"]);
  assert.deepEqual(replyAllDefault(undefined, LEAD, OP), []);
  assert.deepEqual(replyAllDefault("partner@alfitouri.com", LEAD, OP), [], "not an array → nothing");
  assert.equal(replyAllDefault(Array.from({ length: 9 }, (_, i) => `p${i}@x.com`), LEAD, OP).length, MAX_CC);
});

test("crm_get_lead timeline shows who was in copy, on inbound and outbound mail", () => {
  const base = { id: "i", direction: "INBOUND", channel: "EMAIL", subject: "Re: x", body: "thanks", occurredAt: new Date("2026-10-02T10:00:00Z"), createdByName: null };
  const inbound = shapeInteraction({ ...base, type: "EMAIL_IN", metadata: { attachmentCount: 0, cc: ["partner@alfitouri.com"] } });
  assert.deepEqual(inbound.cc, ["partner@alfitouri.com"]);
  assert.equal(inbound.untrusted_content, "thanks", "the body stays untrusted");
  const out = shapeInteraction({ ...base, type: "EMAIL_OUT", direction: "OUTBOUND", metadata: { via: "mcp", cc: ["partner@alfitouri.com"] } });
  assert.deepEqual(out.cc, ["partner@alfitouri.com"]);
  const none = shapeInteraction({ ...base, type: "EMAIL_IN", metadata: { attachmentCount: 0 } });
  assert.equal("cc" in none, false, "no key when nobody was in copy");
});

test("the inbound poller stores the reply-all list on EMAIL_IN, excluding the operator and the lead", async () => {
  // processInbound talks to IMAP and the database, so its wiring is checked on
  // the source; the rules themselves are tested above.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/lib/emailInbound/processInbound.ts", "utf8");
  assert.match(src, /replyAllRecipients\(parsed, \[settings\.fromAddress, leadEmail\], canonicalizeEmail\)/);
  assert.match(src, /\.\.\.\(replyCc\.length \? \{ cc: replyCc \} : \{\}\)/);
});
