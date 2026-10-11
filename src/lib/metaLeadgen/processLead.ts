// The one processing path for a Meta leadgen_id — shared by the webhook
// (src/app/api/webhooks/meta-leadgen) and the fallback poller
// (src/app/api/cron/meta-leadgen-poll). Idempotent on leadgen_id via
// MetaLeadgenEvent; see the schema comment there for the claim/DONE contract.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { canonicalizeEmail } from "@/lib/emailInbound/matchLead";
import { fetchForm, fetchLead, MetaTokenError, type MetaLead } from "./graph";
import { mapFieldData, BUDGETS, CHANNEL_LABEL, type MappedLead } from "./mapFields";
import { alertBoth, buildLeadMessage } from "./notify";

// A PROCESSING claim older than this belongs to a run that died mid-way.
export const STALE_CLAIM_MS = 5 * 60_000;
const ACTOR = "Meta Lead Ads";

export type ProcessResult =
  | { status: "created" | "attached"; leadId: string; notified: boolean }
  | { status: "skipped"; reason: "done" | "in-flight" }
  | { status: "failed"; error: string; tokenError: boolean };

type Claim = { ok: true } | { ok: false; reason: "done" | "in-flight" };

async function claim(leadgenId: string): Promise<Claim> {
  const row = await prisma.metaLeadgenEvent.findUnique({ where: { leadgenId } });
  if (!row) {
    try {
      await prisma.metaLeadgenEvent.create({ data: { leadgenId, status: "PROCESSING", attempts: 1 } });
      return { ok: true };
    } catch (e) {
      // The other path (webhook vs poller) claimed it a moment ago.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, reason: "in-flight" };
      throw e;
    }
  }
  if (row.status === "DONE") return { ok: false, reason: "done" };
  if (row.status === "PROCESSING" && Date.now() - row.updatedAt.getTime() < STALE_CLAIM_MS) return { ok: false, reason: "in-flight" };
  // FAILED, or a stale PROCESSING claim: take it over — conditionally, so two
  // concurrent retries can't both win.
  const taken = await prisma.metaLeadgenEvent.updateMany({
    where: { leadgenId, status: row.status, updatedAt: row.updatedAt },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  return taken.count === 1 ? { ok: true } : { ok: false, reason: "in-flight" };
}

async function findExistingLeadId(email: string | null): Promise<string | null> {
  const key = canonicalizeEmail(email);
  if (!key) return null;
  // Gmail-aware canonicalisation can't be a SQL filter — same in-JS compare the
  // inbound-email matcher and the MCP duplicate check already make.
  const leads = await prisma.lead.findMany({ where: { deletedAt: null, email: { not: null } }, select: { id: true, email: true, createdAt: true } });
  const hits = leads.filter((l) => canonicalizeEmail(l.email) === key);
  if (!hits.length) return null;
  return hits.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).id;
}

function timelineBody(lead: MetaLead, formName: string | null, m: MappedLead, outcome: "CREATED" | "ATTACHED"): string {
  const lines = [
    outcome === "CREATED" ? "Lead created from a Meta lead form." : "Existing lead submitted the Meta lead form again.",
    `Form: ${formName ?? lead.form_id ?? "-"}`,
    `Campaign: ${lead.campaign_name ?? "-"}`,
    `Ad set: ${lead.adset_name ?? "-"}`,
    `Ad: ${lead.ad_name ?? "-"}${lead.ad_id ? ` (${lead.ad_id})` : ""}`,
    `Submitted: ${lead.created_time}`,
    `Budget: ${m.budget ? BUDGETS[m.budget].label : "not answered"}`,
    `Prefers: ${m.preferredChannel ? CHANNEL_LABEL[m.preferredChannel] : "not answered"}`,
  ];
  if (m.budget === "<2") lines.push("Note: below Private Collection threshold");
  if (m.placeholderReason) lines.push(`Warning: phone looks like a placeholder (${m.placeholderReason})`);
  for (const u of m.unmatched) lines.push(`Warning: answer could not be mapped — ${u.name}: ${u.value}`);
  lines.push("", "All answers:", ...m.answers.map((a) => `• ${a.name}: ${a.value}`));
  return lines.join("\n");
}

async function markFailed(leadgenId: string, error: unknown, tokenError: boolean): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const row = await prisma.metaLeadgenEvent
    .update({ where: { leadgenId }, data: { status: "FAILED", lastError: message.slice(0, 2000) } })
    .catch((e) => {
      console.error(`meta-leadgen: could not mark ${leadgenId} FAILED`, e);
      return null;
    });
  // Token problems get their own, throttled alert from the caller — not one
  // per lead. Everything else: one alert per leadgen_id, not one per retry.
  if (tokenError || (row && row.alertedAt)) return;
  const sent = await alertBoth(
    `Meta lead import failed: ${leadgenId}`,
    `⚠️ Meta lead import failed\nleadgen_id: ${leadgenId}\n${message}\nThe poller retries every 15 minutes; you won't be alerted again for this lead.`,
  );
  if (row && (sent.telegram || sent.email)) {
    await prisma.metaLeadgenEvent.update({ where: { leadgenId }, data: { alertedAt: new Date() } }).catch(() => {});
  }
}

/** Sends a stored notification and stamps telegramSentAt. Never throws. */
export async function sendOwedNotification(leadgenId: string, text: string, leadId: string | null, outcome: string | null): Promise<boolean> {
  try {
    const res = await sendTelegramMessage(text);
    if (!res) return false; // Telegram not configured in this environment
    await prisma.metaLeadgenEvent.update({ where: { leadgenId }, data: { telegramSentAt: new Date() } });
    if (leadId && outcome === "CREATED") await prisma.lead.update({ where: { id: leadId }, data: { telegramNotified: true } }).catch(() => {});
    return true;
  } catch (e) {
    console.error(`meta-leadgen: telegram for ${leadgenId} failed (poller will resend)`, e);
    return false;
  }
}

export async function processLeadgen(opts: { leadgenId: string; formId?: string | null; prefetched?: MetaLead; via: "webhook" | "poller" }): Promise<ProcessResult> {
  const { leadgenId } = opts;
  const c = await claim(leadgenId);
  if (!c.ok) return { status: "skipped", reason: c.reason };

  try {
    const lead = opts.prefetched ?? (await fetchLead(leadgenId));
    const formId = lead.form_id ?? opts.formId ?? null;
    const form = formId ? await fetchForm(formId) : null;
    const formName = form?.name ?? null;
    const m = mapFieldData(lead.field_data ?? [], formName, form?.locale);
    const existingId = await findExistingLeadId(m.email);
    const outcome = existingId ? "ATTACHED" : "CREATED";
    const occurredAt = lead.created_time ? new Date(lead.created_time) : new Date();
    const body = timelineBody(lead, formName, m, outcome);
    const metadata = {
      source: "meta_leadgen",
      via: opts.via,
      leadgenId,
      formId,
      formName,
      adId: lead.ad_id ?? null,
      adName: lead.ad_name ?? null,
      adsetName: lead.adset_name ?? null,
      campaignName: lead.campaign_name ?? null,
      createdTime: lead.created_time ?? null,
      isOrganic: lead.is_organic ?? null,
      budget: m.budget,
      preferredChannel: m.preferredChannel,
      placeholderPhone: m.placeholderReason,
      unmatched: m.unmatched,
      fieldData: lead.field_data ?? [],
    } satisfies Prisma.InputJsonObject;

    const leadId = await prisma.$transaction(async (tx) => {
      let id = existingId;
      if (!id) {
        const created = await tx.lead.create({
          data: {
            source: "META_LEAD_AD",
            status: "NEW",
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email,
            phone: m.phone,
            countryOfResidence: m.countryOfResidence,
            languagePreference: m.languagePreference,
            sourceLocale: m.languagePreference,
            budgetMin: m.budgetMin,
            budgetMax: m.budgetMax,
            preferredChannel: m.preferredChannel,
            utmSource: "facebook",
            utmMedium: "lead_ad",
            utmCampaign: lead.campaign_name ?? null,
            utmContent: lead.ad_name ?? null,
            pageSource: formName ? `Meta lead form: ${formName}` : "Meta lead form",
          },
          select: { id: true },
        });
        id = created.id;
        await tx.leadActivity.create({ data: { leadId: id, type: "INBOUND", content: "Lead received via Meta lead form", createdBy: ACTOR } });
      }
      await tx.leadInteraction.create({
        data: { leadId: id, type: "SYSTEM", direction: "INBOUND", channel: "SYSTEM", subject: "Meta lead form submitted", body, occurredAt, createdByName: ACTOR, metadata },
      });
      const notification = buildLeadMessage({
        outcome,
        language: m.languagePreference,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        phone: m.phone,
        budget: m.budget,
        preferredChannel: m.preferredChannel,
        campaignName: lead.campaign_name ?? null,
        formName,
        placeholderReason: m.placeholderReason,
        unmatchedCount: m.unmatched.length,
        leadId: id,
      });
      await tx.metaLeadgenEvent.update({
        where: { leadgenId },
        data: { status: "DONE", outcome, leadId: id, formId, formName, lastError: null, notification },
      });
      return id;
    });

    const row = await prisma.metaLeadgenEvent.findUniqueOrThrow({ where: { leadgenId }, select: { notification: true } });
    const notified = await sendOwedNotification(leadgenId, row.notification!, leadId, outcome);
    return { status: outcome === "CREATED" ? "created" : "attached", leadId, notified };
  } catch (e) {
    const tokenError = e instanceof MetaTokenError;
    await markFailed(leadgenId, e, tokenError);
    return { status: "failed", error: e instanceof Error ? e.message : String(e), tokenError };
  }
}

/** DONE rows whose Telegram never went out (Telegram down at the time). */
export async function resendOwedNotifications(): Promise<number> {
  const owed = await prisma.metaLeadgenEvent.findMany({
    where: { status: "DONE", telegramSentAt: null, notification: { not: null }, updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { leadgenId: true, notification: true, leadId: true, outcome: true },
  });
  let sent = 0;
  for (const r of owed) if (await sendOwedNotification(r.leadgenId, r.notification!, r.leadId, r.outcome)) sent++;
  return sent;
}
