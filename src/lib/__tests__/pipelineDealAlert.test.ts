import { test } from "node:test";
import assert from "node:assert/strict";
import { dealAlertChat, dealAlertHtml } from "@/lib/partner/pipeline/dealAlert";

test("dealAlertHtml says who set which client to which stage, with the deal and the CRM link, escaped", () => {
  const html = dealAlertHtml({ partnerName: "Paul <P>", client: "Anna Berg", stage: "RESERVED", project: "Sea View A12", price: 350000, url: "https://x.test/crm/leads/l1" });
  assert.equal(
    html,
    'Partner Paul &lt;P&gt; set Anna Berg to Reserved: Sea View A12, 350,000 €. Please check the deal.\n<a href="https://x.test/crm/leads/l1">Open the lead in the CRM</a>',
  );
  assert.match(dealAlertHtml({ partnerName: "P", client: "C", stage: "CLOSED", project: null, price: null, url: "u" }), /^Partner P set C to Closed: no project, no price\./);
});

test("dealAlertChat: the active manager's chat, else the owner's, else none", () => {
  assert.equal(dealAlertChat({ telegramChatId: "m", isActive: true }, { telegramChatId: "o" }), "m");
  assert.equal(dealAlertChat({ telegramChatId: null, isActive: true }, { telegramChatId: "o" }), "o");
  assert.equal(dealAlertChat({ telegramChatId: "m", isActive: false }, { telegramChatId: "o" }), "o");
  assert.equal(dealAlertChat(null, null), null);
});
