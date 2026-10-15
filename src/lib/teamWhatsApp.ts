// Lead announcements in the team WhatsApp group (2026-10-15), sent from our own
// number through OpenWA. Started with Meta leads; every source that pings
// Telegram about a NEW lead now posts the same text there too: the website
// form (/api/leads, incl. guide downloads), the partner form (/api/email) and
// the ROI calculator (via recordInboundLead). The Private Collection site
// (separate repo, /var/www/private-collection) has its own copy of this.
//
// One switch for all of them: META_LEAD_WHATSAPP_CHAT (the group's …@g.us id)
// in /var/www/shared/.env. Unset = off. Best-effort: never throws, never blocks
// the lead itself.
import { createOpenWaClient, type OpenWaClient } from "@/lib/openwa/client";

/** The team group chat id, or null = off. */
export const teamWhatsAppChat = (env: NodeJS.ProcessEnv = process.env): string | null => env.META_LEAD_WHATSAPP_CHAT?.trim() || null;

/** Our Telegram notifications are Telegram-HTML (<b>, <a>, escaped entities);
 *  WhatsApp wants *bold*, bare URLs and plain characters. */
export function telegramHtmlToWhatsApp(html: string): string {
  return html
    .replace(/<b>([^<]*)<\/b>/g, "*$1*")
    .replace(/<a href="([^"]*)">[^<]*<\/a>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/** Posts a lead notification (Telegram-HTML text) to the team group. */
export async function notifyTeamWhatsApp(
  telegramHtml: string,
  deps: { env?: NodeJS.ProcessEnv; client?: () => OpenWaClient } = {},
): Promise<boolean> {
  const chat = teamWhatsAppChat(deps.env ?? process.env);
  if (!chat) return false;
  try {
    const client = deps.client ? deps.client() : createOpenWaClient({ env: deps.env });
    await client.sendText(chat, telegramHtmlToWhatsApp(telegramHtml));
    return true;
  } catch (e) {
    console.error("team WhatsApp notification failed", e instanceof Error ? e.message : e);
    return false;
  }
}
