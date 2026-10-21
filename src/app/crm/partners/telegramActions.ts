"use server";
/**
 * Partner Telegram bot — CRM owner panel (phase 3e, Decision 5). Owner only (isOwner/isActive read from
 * the DB by requireCrmUser). Neither the bot token nor the webhook secret is ever returned.
 */
import { requireCrmUser } from "@/lib/crm/session";
import { writeAudit } from "@/lib/crm/audit";
import { PARTNER_WEBHOOK_URL, getPartnerWebhookInfo, partnerBotConfigured, setPartnerWebhook, type PartnerWebhookInfo } from "@/lib/partner/telegramApi";

const DENIED = "Only the owner can manage the partner Telegram bot.";
const NOT_CONFIGURED = "The partner bot is not configured (PARTNER_TELEGRAM_BOT_TOKEN, _BOT_USERNAME, _WEBHOOK_SECRET).";

async function owner() {
  const actor = await requireCrmUser();
  return actor.isActive && actor.isOwner ? actor : null;
}

export async function partnerTelegramStatusAction(): Promise<{ ok: true; info: PartnerWebhookInfo; expectedUrl: string } | { error: string }> {
  if (!(await owner())) return { error: DENIED };
  if (!partnerBotConfigured()) return { error: NOT_CONFIGURED };
  const r = await getPartnerWebhookInfo();
  return r.ok ? { ok: true, info: r.info, expectedUrl: PARTNER_WEBHOOK_URL } : { error: `Telegram: ${r.description}` };
}

export async function registerPartnerTelegramWebhookAction(): Promise<{ ok: true; notice: string } | { error: string }> {
  const actor = await owner();
  if (!actor) return { error: DENIED };
  if (!partnerBotConfigured()) return { error: NOT_CONFIGURED };
  const r = await setPartnerWebhook();
  await writeAudit(actor, "partner_telegram_webhook_set", "partner_bot", "partner-telegram", {
    url: PARTNER_WEBHOOK_URL, ok: r.ok, ...(r.ok ? {} : { description: r.description }),
  });
  return r.ok ? { ok: true, notice: "Webhook registered" } : { error: `Telegram: ${r.description}` };
}
