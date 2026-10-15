// Private Collection enquiries → the CRM (2026-10-15). Called server-to-server
// by the Private Collection site (private.cyprusvipestates.com, /var/www/
// private-collection, its app/api/lead/route.ts) instead of its old Monday.com
// board. Authenticated with a shared secret (PC_LEAD_SECRET, in both apps'
// env); anything else gets 401 and writes nothing.
//
// Creates a lead (source PRIVATE_COLLECTION) or, when the email or phone is
// already a lead, adds the enquiry to that lead's timeline (a LOST lead goes
// back to NEW, like Meta leads). Then notifies like every website lead:
// Telegram, e-mail to EMAIL_TO, and the team WhatsApp group — each
// best-effort. The answer tells the caller whether the CRM has it; on a
// failure the caller sends its own fallback notice so nothing is lost.
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { notifyTeamWhatsApp } from "@/lib/teamWhatsApp";
import { findDuplicateLead } from "@/lib/crm/createLead";
import { emailKey } from "@/lib/crm/leadIdentity";
import { parsePcLead, pcTelegram, pcTimelineBody } from "@/lib/privateCollectionLead";

export const dynamic = "force-dynamic";
const ACTOR = "Private Collection site";

function authorised(req: NextRequest): boolean {
  const secret = process.env.PC_LEAD_SECRET?.trim();
  if (!secret) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = parsePcLead(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const { lead: l, raw } = parsed;

  let result: { id: string; outcome: "CREATED" | "ATTACHED"; priorStatus: string | null };
  try {
    result = await prisma.$transaction(async (tx) => {
      // Two submissions of the same address at once must not both create.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"pc-lead:" + (emailKey(l.email) ?? l.email)}))`;
      const dup = await findDuplicateLead(l.email, l.phone);
      const occurredAt = new Date();
      if (dup) {
        if (dup.status === "LOST") {
          await tx.lead.update({ where: { id: dup.id }, data: { status: "NEW" } });
          await tx.leadInteraction.create({
            data: { leadId: dup.id, type: "STATUS_CHANGE", channel: "SYSTEM", body: "Status LOST → NEW (sent the Private Collection enquiry form)", occurredAt, createdByName: ACTOR, metadata: { from: "LOST", to: "NEW", source: "private_collection" } },
          });
        }
        await tx.leadInteraction.create({
          data: { leadId: dup.id, type: "SYSTEM", direction: "INBOUND", channel: "SYSTEM", subject: "Private Collection enquiry", body: pcTimelineBody(l, raw, "ATTACHED"), occurredAt, createdByName: ACTOR, metadata: { source: "private_collection", answers: raw, matchedOn: dup.matchedOn } },
        });
        return { id: dup.id, outcome: "ATTACHED" as const, priorStatus: dup.status };
      }
      const created = await tx.lead.create({
        data: {
          source: "PRIVATE_COLLECTION",
          status: "NEW",
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          phone: l.phone,
          languagePreference: l.languagePreference,
          sourceLocale: l.languagePreference,
          budgetMin: l.budgetMin,
          budgetMax: l.budgetMax,
          preferredChannel: l.preferredChannel,
          message: [l.purpose ? `Purpose: ${l.purpose}` : null, l.message].filter(Boolean).join("\n\n") || null,
          pageSource: "private.cyprusvipestates.com",
        },
        select: { id: true },
      });
      await tx.leadActivity.create({ data: { leadId: created.id, type: "INBOUND", content: "Lead received via the Private Collection enquiry form", createdBy: ACTOR } });
      await tx.leadInteraction.create({
        data: { leadId: created.id, type: "SYSTEM", direction: "INBOUND", channel: "SYSTEM", subject: "Private Collection enquiry", body: pcTimelineBody(l, raw, "CREATED"), occurredAt, createdByName: ACTOR, metadata: { source: "private_collection", answers: raw } },
      });
      return { id: created.id, outcome: "CREATED" as const, priorStatus: null };
    });
  } catch (e) {
    console.error("private-collection-lead: CRM write failed", e);
    return NextResponse.json({ ok: false, error: "crm write failed" }, { status: 500 });
  }

  // Notifications — the lead is safe in the CRM from here on, so none of these
  // may turn the answer into a failure (the caller would send a duplicate notice).
  const crmLink = `${process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239"}/admin/crm/${result.id}`;
  const tg = pcTelegram(l, { outcome: result.outcome, crmLink, priorStatus: result.priorStatus });
  const name = `${l.firstName} ${l.lastName}`.trim();
  try {
    if (await sendTelegramMessage(tg)) await prisma.lead.update({ where: { id: result.id }, data: { telegramNotified: true } }).catch(() => {});
  } catch (e) { console.error("private-collection-lead: telegram failed", e); }
  try {
    await sendEmail({
      subject: result.outcome === "CREATED" ? `New Private Collection enquiry: ${name}` : `Private Collection enquiry (existing lead): ${name}`,
      text: tg.replace(/<a href="([^"]*)">[^<]*<\/a>/g, "$1").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"),
      html: tg.split("\n").join("<br/>\n"),
      replyTo: l.email,
    });
    if (result.outcome === "CREATED") await prisma.lead.update({ where: { id: result.id }, data: { emailNotified: true } }).catch(() => {});
  } catch (e) { console.error("private-collection-lead: e-mail failed", e); }
  await notifyTeamWhatsApp(tg);

  return NextResponse.json({ ok: true, leadId: result.id, outcome: result.outcome });
}
