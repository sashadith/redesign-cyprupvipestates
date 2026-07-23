// Shared "new inbound lead" handling for the public capture routes (audit M1 + L1):
// records an INBOUND activity on the lead's timeline and optionally pings Telegram +
// sets the telegramNotified flag. Used by /api/email, /api/roi-calculator and
// /api/monday-newsletter so notification behaviour is consistent across sources.
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function recordInboundLead(opts: {
  leadId: string;
  source: string;
  email: string;
  name?: string;
  phone?: string | null;
  page?: string;
  notifyTelegram?: boolean; // default true; pass false for low-value/high-volume sources
}) {
  // Timeline entry so every lead (not just manual ones) has a creation activity.
  const inboundContent = `Lead received via ${opts.source.replace(/_/g, " ")}`;
  try {
    await prisma.leadActivity.create({
      data: { leadId: opts.leadId, type: "INBOUND", content: inboundContent, createdBy: "website" },
    });
  } catch (e) {
    console.error("inbound activity error:", e);
  }
  try {
    await prisma.leadInteraction.create({
      data: { leadId: opts.leadId, type: "SYSTEM", direction: "INBOUND", channel: "SYSTEM", body: inboundContent, createdByName: "website" },
    });
  } catch (e) {
    console.error("inbound interaction error:", e);
  }

  if (opts.notifyTelegram === false) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const link = `${siteUrl}/admin/crm/${opts.leadId}`;
  const msg =
    `<b>New ${esc(opts.source.replace(/_/g, " "))} lead</b>\n` +
    `<b>${esc(opts.name || "-")}</b>\n` +
    `Email: ${esc(opts.email)}\nPhone: ${esc(opts.phone || "-")}\n` +
    (opts.page ? `Page: ${esc(opts.page)}\n` : "") +
    `\n<a href="${link}">Open in CRM</a>`;
  try {
    await sendTelegramMessage(msg);
    await prisma.lead.update({ where: { id: opts.leadId }, data: { telegramNotified: true } });
  } catch (e) {
    console.error("lead telegram error:", e);
  }
}
