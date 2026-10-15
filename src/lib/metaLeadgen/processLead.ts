// The one processing path for a Meta leadgen_id — shared by the webhook
// (src/app/api/webhooks/meta-leadgen) and the fallback poller
// (src/app/api/cron/meta-leadgen-poll). Idempotent on leadgen_id via
// MetaLeadgenEvent; see the schema comment there for the claim/DONE contract.
import { Prisma, type LeadStatus } from "@prisma/client";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
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

// `attempts` is the fencing token: the final DONE write only lands if the row
// still carries the attempt number this run claimed it with.
type Claim = { ok: true; attempts: number } | { ok: false; reason: "done" | "in-flight" };

async function claim(leadgenId: string): Promise<Claim> {
  const row = await prisma.metaLeadgenEvent.findUnique({ where: { leadgenId } });
  if (!row) {
    // skipDuplicates (ON CONFLICT DO NOTHING) rather than catching P2002: the
    // other path (webhook vs poller) claiming it a moment ago is expected, not
    // an error worth Prisma's error log.
    const { count } = await prisma.metaLeadgenEvent.createMany({ data: [{ leadgenId, status: "PROCESSING", attempts: 1 }], skipDuplicates: true });
    return count === 1 ? { ok: true, attempts: 1 } : { ok: false, reason: "in-flight" };
  }
  if (row.status === "DONE") return { ok: false, reason: "done" };
  if (row.status === "PROCESSING" && Date.now() - row.updatedAt.getTime() < STALE_CLAIM_MS) return { ok: false, reason: "in-flight" };
  // FAILED, or a stale PROCESSING claim: take it over — conditionally, so two
  // concurrent retries can't both win.
  const taken = await prisma.metaLeadgenEvent.updateMany({
    where: { leadgenId, status: row.status, updatedAt: row.updatedAt },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  return taken.count === 1 ? { ok: true, attempts: row.attempts + 1 } : { ok: false, reason: "in-flight" };
}

type Db = Prisma.TransactionClient | typeof prisma;
type ExistingLead = { id: string; status: LeadStatus };

/** Same person = same canonical email on a live, non-newsletter lead (the
 *  MCP create-lead duplicate check's rule): a newsletter subscriber filling in
 *  the form becomes a real lead, not a note on a row nobody's lists show. */
async function findExistingLead(db: Db, email: string | null): Promise<ExistingLead | null> {
  const key = canonicalizeEmail(email);
  if (!key) return null;
  // Gmail-aware canonicalisation can't be a SQL filter — same in-JS compare the
  // inbound-email matcher and the MCP duplicate check already make.
  const leads = await db.lead.findMany({
    where: { deletedAt: null, email: { not: null }, ...EXCLUDE_NEWSLETTER },
    select: { id: true, email: true, createdAt: true, status: true },
  });
  const hits = leads.filter((l) => canonicalizeEmail(l.email) === key);
  if (!hits.length) return null;
  const hit = hits.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return { id: hit.id, status: hit.status };
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

async function markFailed(leadgenId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.metaLeadgenEvent
    .update({ where: { leadgenId }, data: { status: "FAILED", lastError: message.slice(0, 2000) } })
    .catch((e) => console.error(`meta-leadgen: could not mark ${leadgenId} FAILED`, e));
  // No alert here (2026-10-15). A first attempt that fails is often
  // recovered seconds later by the same poll run's retry-by-id sweep — on
  // 2026-10-14 the operator got "import failed" for a lead that was created 9 s
  // after the mail. The poller alerts at the END of its run, only for leads
  // that are still FAILED then (alertUnresolvedFailures). A webhook failure is
  // retried by the next poll run (≤15 min) and alerted only if that fails too.
}

export const failureAlertText = (leadgenId: string, error: string | null) =>
  `⚠️ Meta lead import failed\nleadgen_id: ${leadgenId}\n${error ?? "unknown error"}\nThe import was retried in the same run and failed again. The poller keeps retrying every 15 minutes; you won't be alerted again for this lead.`;

/** End of a poll run: one alert per leadgen_id that this run tried and that is
 *  STILL failed now, never one already alerted. Token and config failures are
 *  excluded by the caller (they have their own throttled alert). Returns the
 *  ids alerted. Never throws. */
export async function alertUnresolvedFailures(triedLeadgenIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(triedLeadgenIds.filter((id) => !id.startsWith("form:"))));
  if (!ids.length) return [];
  const rows = await prisma.metaLeadgenEvent
    .findMany({ where: { leadgenId: { in: ids }, status: "FAILED", alertedAt: null }, select: { leadgenId: true, lastError: true } })
    .catch((e) => {
      console.error("meta-leadgen: could not read failed rows for alerting", e);
      return [] as { leadgenId: string; lastError: string | null }[];
    });
  const alerted: string[] = [];
  for (const r of rows) {
    const sent = await alertBoth(`Meta lead import failed: ${r.leadgenId}`, failureAlertText(r.leadgenId, r.lastError));
    if (sent.telegram || sent.email) {
      await prisma.metaLeadgenEvent.update({ where: { leadgenId: r.leadgenId }, data: { alertedAt: new Date() } }).catch(() => {});
      alerted.push(r.leadgenId);
    }
  }
  return alerted;
}

/** Sends a stored notification exactly once: telegramSentAt is CLAIMED
 *  before the send (only one caller can flip it from null) and released
 *  again if the send fails, so the poller retries. Never throws. */
export async function sendOwedNotification(leadgenId: string, text: string, leadId: string | null, outcome: string | null): Promise<boolean> {
  const claimed = await prisma.metaLeadgenEvent
    .updateMany({ where: { leadgenId, status: "DONE", telegramSentAt: null }, data: { telegramSentAt: new Date() } })
    .catch(() => ({ count: 0 }));
  if (claimed.count !== 1) return false;
  try {
    const res = await sendTelegramMessage(text);
    if (!res) throw new Error("Telegram not configured");
    if (leadId && outcome === "CREATED") await prisma.lead.update({ where: { id: leadId }, data: { telegramNotified: true } }).catch(() => {});
    return true;
  } catch (e) {
    console.error(`meta-leadgen: telegram for ${leadgenId} failed (poller will resend)`, e);
    await prisma.metaLeadgenEvent.update({ where: { leadgenId }, data: { telegramSentAt: null } }).catch(() => {});
    return false;
  }
}

export async function processLeadgen(opts: { leadgenId: string; formId?: string | null; prefetched?: MetaLead; via: "webhook" | "poller" }): Promise<ProcessResult> {
  const { leadgenId } = opts;
  let c: Claim;
  try {
    c = await claim(leadgenId);
  } catch (e) {
    return { status: "failed", error: `claim failed: ${e instanceof Error ? e.message : String(e)}`, tokenError: false };
  }
  if (!c.ok) return { status: "skipped", reason: c.reason };
  const claimedAttempts = c.attempts;

  try {
    const lead = opts.prefetched ?? (await fetchLead(leadgenId));
    const formId = lead.form_id ?? opts.formId ?? null;
    const form = formId ? await fetchForm(formId) : null;
    const formName = form?.name ?? null;
    const m = mapFieldData(lead.field_data ?? [], formName, form?.locale);
    const occurredAt = lead.created_time ? new Date(lead.created_time) : new Date();
    const emailKey = canonicalizeEmail(m.email);
    const metaBase = {
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

    const { leadId, outcome } = await prisma.$transaction(async (tx) => {
      // Two different leadgen_ids with the same email arriving together (the
      // form sent twice, or two forms) must not both CREATE: serialise on the
      // email, then look up again under the lock.
      if (emailKey) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"meta-leadgen:" + emailKey}))`;
      const existing = await findExistingLead(tx, m.email);
      const outcome: "CREATED" | "ATTACHED" = existing ? "ATTACHED" : "CREATED";
      let id = existing?.id ?? null;
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
      } else if (existing?.status === "LOST") {
        // A lost lead asking again is a live lead again — back to NEW so it
        // shows up in the active lists and the Action Center. CLOSED (a deal
        // done) is left alone; the Telegram names the status instead.
        await tx.lead.update({ where: { id }, data: { status: "NEW" } });
        await tx.leadInteraction.create({
          data: { leadId: id, type: "STATUS_CHANGE", channel: "SYSTEM", body: "Status LOST → NEW (submitted the Meta lead form again)", occurredAt, createdByName: ACTOR, metadata: { from: "LOST", to: "NEW", source: "meta_leadgen", leadgenId } },
        });
      }
      const body = timelineBody(lead, formName, m, outcome);
      const metadata = { ...metaBase, outcome };
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
        priorStatus: existing && existing.status !== "LOST" ? existing.status : null,
        reopened: existing?.status === "LOST",
      });
      const done = await tx.metaLeadgenEvent.updateMany({
        where: { leadgenId, status: "PROCESSING", attempts: claimedAttempts },
        data: { status: "DONE", outcome, leadId: id, formId, formName, lastError: null, notification },
      });
      // Fenced: another run took this claim over meanwhile — roll back ours.
      if (done.count !== 1) throw new Error(`claim on ${leadgenId} was taken over by another run; rolled back`);
      return { leadId: id, outcome };
    });

    const row = await prisma.metaLeadgenEvent.findUniqueOrThrow({ where: { leadgenId }, select: { notification: true } });
    const notified = await sendOwedNotification(leadgenId, row.notification!, leadId, outcome);
    return { status: outcome === "CREATED" ? "created" : "attached", leadId, notified };
  } catch (e) {
    const tokenError = e instanceof MetaTokenError;
    await markFailed(leadgenId, e);
    return { status: "failed", error: e instanceof Error ? e.message : String(e), tokenError };
  }
}

/** DONE rows whose Telegram never went out (Telegram down at the time). */
export async function resendOwedNotifications(): Promise<number> {
  const owed = await prisma.metaLeadgenEvent.findMany({
    // Older than 2 min: a row that just turned DONE is still being sent by
    // the run that processed it.
    where: { status: "DONE", telegramSentAt: null, notification: { not: null }, updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000), lt: new Date(Date.now() - 2 * 60_000) } },
    select: { leadgenId: true, notification: true, leadId: true, outcome: true },
  });
  let sent = 0;
  for (const r of owed) if (await sendOwedNotification(r.leadgenId, r.notification!, r.leadId, r.outcome)) sent++;
  return sent;
}

/** Every unfinished leadgen_id of any age (FAILED, or a PROCESSING claim
 *  whose run died) — retried by id, independent of the poller's time window,
 *  so a lead that failed or got stuck is never aged out. Bounded by Meta's
 *  90-day retention. */
export async function unfinishedLeadgenIds(): Promise<{ leadgenId: string; formId: string | null }[]> {
  return prisma.metaLeadgenEvent.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
      OR: [{ status: "FAILED" }, { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } }],
    },
    select: { leadgenId: true, formId: true },
  });
}
