// Admin-facing Telegram/email copy for Meta Lead Ads — English, like every
// admin notification. Pure builders + two senders that never let one channel's
// failure swallow the other (sendFeedNotification sends email only after a
// successful Telegram call, which is the wrong order for "Telegram is down").
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { BUDGETS, CHANNEL_LABEL, REGION_BY_LANGUAGE, type BudgetKey } from "./mapFields";
import type { LeadPreferredChannel } from "@prisma/client";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "[TEST]" in the testbed (NOTIFY_PREFIX), nothing in production. */
export const notifyPrefix = () => (process.env.NOTIFY_PREFIX ? `${process.env.NOTIFY_PREFIX} ` : "");

export const adminLeadUrl = (leadId: string) => `${process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239"}/admin/crm/${leadId}`;

export function buildLeadMessage(o: {
  outcome: "CREATED" | "ATTACHED";
  language: "de" | "en" | null;
  name: string;
  email: string | null;
  phone: string | null;
  budget: BudgetKey | null;
  preferredChannel: LeadPreferredChannel | null;
  campaignName: string | null;
  formName: string | null;
  placeholderReason: string | null;
  unmatchedCount: number;
  leadId: string;
  priorStatus?: string | null; // existing lead's status when it isn't an active one worth stating (e.g. CLOSED)
  reopened?: boolean; // existing lead was LOST and has been set back to NEW
}): string {
  const region = o.language ? ` (${REGION_BY_LANGUAGE[o.language]})` : "";
  const head =
    o.outcome === "CREATED"
      ? `🏛 <b>New Private Collection lead${region}</b>`
      : `🏛 <b>Existing lead submitted the form again${region}</b>`;
  const lines = [
    `${esc(notifyPrefix())}${head}`,
    `<b>${esc(o.name || "-")}</b>`,
    `Budget: ${esc(o.budget ? BUDGETS[o.budget].label : "not answered")} · Prefers: ${esc(o.preferredChannel ? CHANNEL_LABEL[o.preferredChannel] : "not answered")}`,
  ];
  if (o.budget === "<2") lines.push("⚠️ below Private Collection threshold");
  if (o.reopened) lines.push("↩️ was LOST — reopened as NEW");
  if (o.priorStatus === "CLOSED") lines.push("ℹ️ lead status is CLOSED (left unchanged)");
  lines.push([o.email, o.phone].filter(Boolean).map(esc).join(" · ") || "-");
  if (o.placeholderReason) lines.push(`⚠️ phone looks like a placeholder (${esc(o.placeholderReason)})`);
  if (o.unmatchedCount) lines.push(`⚠️ ${o.unmatchedCount} answer(s) could not be mapped — see timeline`);
  lines.push(`Campaign: ${esc(o.campaignName || "-")} · Form: ${esc(o.formName || "-")}`);
  lines.push(`→ <a href="${adminLeadUrl(o.leadId)}">${esc(adminLeadUrl(o.leadId))}</a>`);
  return lines.join("\n");
}

/** Telegram AND email, independently — a failure alert must reach at least
 *  one channel even when the other is the thing that's broken. */
export async function alertBoth(subject: string, text: string): Promise<{ telegram: boolean; email: boolean }> {
  const p = notifyPrefix();
  let telegram = false;
  let email = false;
  try {
    telegram = !!(await sendTelegramMessage(esc(`${p}${text}`)));
  } catch (e) {
    console.error("meta-leadgen alert: telegram failed", e);
  }
  try {
    await sendEmail({ subject: `${p}${subject}`, text: `${p}${text}` });
    email = true;
  } catch (e) {
    console.error("meta-leadgen alert: email failed", e);
  }
  return { telegram, email };
}

export const TOKEN_ALERT_SUBJECT = "Meta lead token invalid — leads are not being imported";

export function tokenAlertText(detail: string): string {
  return [
    `⚠️ ${TOKEN_ALERT_SUBJECT}`,
    detail,
    "Renew the system-user Page access token (docs/META-LEADGEN.md, step 5) and update META_PAGE_ACCESS_TOKEN. Leads are not lost: Meta keeps them 90 days, and once the token works again the poller automatically looks back to its last successful run.",
  ].join("\n");
}
