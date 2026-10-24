import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_GLOBAL, WEBSITE, emailTheme } from "@/lib/design/theme";
import { buildApprovedEmail, buildBankChangedEmail, buildResetEmail, buildVerifyEmail, partnerBaseUrl } from "@/lib/partner/mail";
import {
  buildClaimOutcomeEmail, buildMatchEmail, buildMessageEmail, buildPayoutEmail, buildPresentationOpenedEmail, buildStageEmail, buildTierUpEmail,
} from "@/lib/partner/notify";
import { buildDigestEmail } from "@/lib/partner/digest";

process.env.PARTNER_HOST = "p.example.com";
// Captured from the builder BEFORE the theme change (PARTNER_HOST=p.example.com).
const FIXTURE = "<!doctype html><html><body style=\"margin:0;padding:32px 16px;background:#F5F1E8;font-family:Arial,Helvetica,sans-serif;color:#221C15;font-size:15px;line-height:1.6\"><div style=\"max-width:520px;margin:0 auto\"><div style=\"text-align:center;padding:0 0 24px\"><img src=\"https://p.example.com/crm/brand/logo-full.png\" width=\"250\" height=\"35\" alt=\"Cyprus VIP Estates\" style=\"display:inline-block;border:0;width:250px;height:35px\"></div><div style=\"background:#FBF9F3;border:1px solid #E4DCCB;border-radius:16px;padding:32px 28px\"><p style=\"margin:0 0 16px\">Dear Anna,</p><p style=\"margin:0 0 16px\">Good news: your partner account is approved. You can now log in and find your personal referral link.</p><p style=\"margin:24px 0 16px\"><a href=\"https://x/login\" style=\"display:inline-block;background:#8E6B3D;color:#ffffff;text-decoration:none;font-weight:bold;letter-spacing:0.03em;padding:13px 24px;border-radius:16px\">Log in</a></p><p style=\"margin:0 0 20px;font-size:13px;color:#6B5E4E;word-break:break-all\">https://x/login</p><div style=\"height:1px;line-height:1px;font-size:0;background:#C29A5E;margin:0 0 20px\">&nbsp;</div><p style=\"margin:0 0 16px\">Kind regards,<br>Cyprus VIP Estates</p></div></div></body></html>";
const web = emailTheme(WEBSITE, DEFAULT_GLOBAL);

test("default theme is byte-identical to the pre-theme HTML except the link-line colour", () => {
  assert.equal(partnerBaseUrl(), "https://p.example.com");
  const html = buildApprovedEmail("en", "Anna", "https://x/login").html;
  assert.equal(html, FIXTURE.replace("#6B5E4E", "#59534C"));
});

test("WEBSITE theme drives every colour", () => {
  const html = buildApprovedEmail("en", "Anna", "https://x/login", web).html;
  for (const s of ["background:#081512", "background:#102826", "color:#EFE9DB", "color:#081512"]) assert.ok(html.includes(s), s);
  assert.ok(!html.includes("#F5F1E8"));
});

test("emailBase scales body and link-line font", () => {
  const html = buildApprovedEmail("en", "Anna", "https://x/login", emailTheme(WEBSITE, { ...DEFAULT_GLOBAL, emailBase: 18 })).html;
  assert.ok(html.includes("font-size:18px"));
  assert.ok(html.includes("font-size:16px"));
});

test("radius 0 gives border-radius:0px on card and button", () => {
  const html = buildApprovedEmail("en", "Anna", "https://x/login", emailTheme(WEBSITE, { ...DEFAULT_GLOBAL, radius: 0 })).html;
  assert.equal(html.split("border-radius:0px").length - 1, 2);
});

test("every builder passes the theme through", () => {
  const common = { partnerFirstName: "Anna", clientName: "Client", link: "https://x/c" };
  const mails = [
    buildVerifyEmail("en", "https://x/v", "Anna", web),
    buildResetEmail("en", "https://x/r", "Anna", web),
    buildBankChangedEmail("en", { name: "Anna", ibanLast4: "1234", changedAt: new Date() }, web),
    buildStageEmail("en", { ...common, stageKey: "stages.onHold" }, web),
    buildMessageEmail("en", { ...common, body: "hi" }, web),
    buildClaimOutcomeEmail("en", { ...common, accepted: true }, web),
    buildPayoutEmail("en", { ...common, amount: "EUR 1", creditNoteNumber: "CN-1" }, web),
    buildMatchEmail("en", { partnerFirstName: "Anna", clientName: "C", projectName: "P", changeType: "price", priceFrom: 1, url: "https://x/p", portalUrl: "https://x" }, web),
    buildPresentationOpenedEmail("en", common, web),
    buildTierUpEmail("en", { partnerFirstName: "Anna", tierName: "Gold", handoverShare: 1, fixShare: 1, portalUrl: "https://x" }, web),
    buildDigestEmail("en", { partnerFirstName: "Anna", content: { updates: [], totals: { expected: 1, earned: 0, developerPaid: 0, paidOut: 0 }, newProjects: [] }, portalUrl: "https://x/home", profileUrl: "https://x/profile" }, web),
  ];
  for (const m of mails) assert.ok(m.html.includes("#102826"));
});
