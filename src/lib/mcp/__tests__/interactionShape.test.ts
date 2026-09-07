import { test } from "node:test";
import assert from "node:assert/strict";
import { interactionShape } from "@/lib/crm/logInteraction";

test("mirrors the admin actions: notes are internal, everything else is contact", () => {
  assert.deepEqual(interactionShape("NOTE"), { direction: null, channel: null, cadence: false, activityRow: true, forcesLeadReacted: false });
  assert.deepEqual(interactionShape("CALL"), { direction: "OUTBOUND", channel: "PHONE", cadence: true, activityRow: false, forcesLeadReacted: false });
  assert.deepEqual(interactionShape("WHATSAPP_OUT"), { direction: "OUTBOUND", channel: "WHATSAPP", cadence: true, activityRow: false, forcesLeadReacted: false });
  assert.deepEqual(interactionShape("WHATSAPP_IN"), { direction: "INBOUND", channel: "WHATSAPP", cadence: true, activityRow: false, forcesLeadReacted: true });
  assert.deepEqual(interactionShape("EMAIL_OUT"), { direction: "OUTBOUND", channel: "EMAIL", cadence: true, activityRow: false, forcesLeadReacted: false });
  assert.deepEqual(interactionShape("EMAIL_IN"), { direction: "INBOUND", channel: "EMAIL", cadence: true, activityRow: false, forcesLeadReacted: true });
});
