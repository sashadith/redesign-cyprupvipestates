import { prisma } from "@/lib/prisma";
import { listPipeline } from "@/lib/partner/pipeline/store";
import { partnerDisplayName } from "@/lib/partner/bankFlow";
import { isoWeek } from "./leadLocalTime";
import { CRM_TZ } from "./today";
import { partnerLeadLight, thresholdsFromEnv } from "./partnerPipelines";
import { managerDigest, type DigestCard } from "./partnerPipelineDigest";

// The Monday summary per manager (partner pipeline, 2026-11-05), run by the crm-sla cron: every run
// from 09:00 Nicosia on Mondays tries, and the sent mark makes it once per ISO week and manager.
// The mark is an AdminAuditLog row (action partner_digest_sent, targetId "partner-digest:<userId>:<year>-W<week>"),
// written after the send succeeded, so a failed send is retried on the next run.

const WEEK_MS = 7 * 86_400_000;
const AUDIT_ACTION = "partner_digest_sent";

export type PartnerDigestResult = { sent: number; errors: string[]; skipped?: string };

/** True on Monday from 09:00 Nicosia time. */
export function isMondaySlot(now: Date, tz = CRM_TZ): boolean {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return get("weekday") === "Mon" && Number(get("hour")) >= 9;
}

export function digestKey(userId: string, now: Date, tz = CRM_TZ): string {
  const { week, monday } = isoWeek(now, tz);
  // The ISO year is the year of the week's Thursday (monday + 3 days).
  const year = new Date(monday.getTime() + 3 * 86_400_000).getUTCFullYear();
  return `partner-digest:${userId}:${year}-W${String(week).padStart(2, "0")}`;
}

export async function runPartnerMondayDigests(deps: {
  now: Date;
  send: (chatId: string, html: string) => Promise<{ ok: boolean; description?: string }>;
}): Promise<PartnerDigestResult> {
  const { now } = deps;
  const out: PartnerDigestResult = { sent: 0, errors: [] };
  if (!isMondaySlot(now)) return { ...out, skipped: "not Monday 09:00 or later" };
  const since = new Date(now.getTime() - WEEK_MS);
  const thresholds = thresholdsFromEnv();
  const managers = await prisma.user.findMany({
    where: { isActive: true, telegramChatId: { not: null }, managedPartners: { some: {} } },
    select: { id: true, telegramChatId: true, managedPartners: { select: { id: true, firstName: true, lastName: true, company: true } } },
  });
  for (const m of managers) {
    if (!m.telegramChatId) continue;
    const key = digestKey(m.id, now);
    try {
      const done = await prisma.adminAuditLog.findFirst({ where: { action: AUDIT_ACTION, targetType: "partner_digest", targetId: key }, select: { id: true } });
      if (done) continue;
      const cards: DigestCard[] = [];
      for (const p of m.managedPartners) {
        const partnerName = partnerDisplayName(p);
        const [pipeline, handed, fresh] = await Promise.all([
          listPipeline(p.id, now),
          prisma.partnerHandoverRequest.count({ where: { partnerId: p.id, state: "ACCEPTED", acceptedAt: { gte: since } } }),
          prisma.partnerClaim.count({ where: { partnerId: p.id, mode: "FIX", OR: [{ reviewedAt: { gte: since } }, { reviewedAt: null, createdAt: { gte: since } }], state: { in: ["ACTIVE", "EXPIRED"] } } }),
        ]);
        for (const c of pipeline.filter((x) => !x.handedOver && !x.expired)) {
          cards.push({
            partnerName, handedOverThisWeek: false, newThisWeek: false,
            overdue: !!c.nextFollowUpAt && c.nextFollowUpAt < now,
            light: partnerLeadLight({ nextFollowUpAt: c.nextFollowUpAt, lastEntryAt: c.lastEntryAt, createdAt: c.since }, now, thresholds),
          });
        }
        for (let i = 0; i < handed; i++) cards.push({ partnerName, light: "green", handedOverThisWeek: true, newThisWeek: false });
        for (let i = 0; i < fresh; i++) cards.push({ partnerName, light: "green", handedOverThisWeek: false, newThisWeek: true });
      }
      const text = managerDigest(cards);
      if (!text) continue;
      const html = `Partner pipelines, this week\n${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
      const r = await deps.send(m.telegramChatId, html);
      if (!r.ok) {
        out.errors.push(`${m.id}: ${r.description ?? "send failed"}`);
        continue;
      }
      await prisma.adminAuditLog.create({ data: { action: AUDIT_ACTION, targetType: "partner_digest", targetId: key, detail: { lines: text.split("\n").length } } });
      out.sent++;
    } catch (e) {
      out.errors.push(`${m.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}
