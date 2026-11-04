// Daily match alerts — server half (partner portal phase 3e, Decision 6). Cron entry:
// src/app/api/cron/partner-match/route.ts. Pure parts: matchAlerts.ts (planner) and matchGlue.ts.
// Writes MATCH outbox rows (delivered by the partner-notify sender, notifySend.ts) and mails each lead
// owner one English digest of the day's alerts on their leads.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import { inventoryChanges } from "@/lib/crm/inventoryChanges";
import { dayKey } from "@/lib/crm/today";
import { REAL_CONTACT_TYPES } from "./claims";
import { COMMITTED_LEAD_STATUSES, activeSince, effectiveClaimState, type ClaimStateValue } from "./claimState";
import { planMatchAlerts, type MatchClaim, type MatchProject } from "./matchAlerts";
import {
  MATCH_CHANGE_CAP, MATCH_CLAIM_CAP, MATCH_DEDUPE_DAYS, MATCH_EVENT_TYPES, MATCH_EXCLUDED_LEAD_STATUSES, OWNER_MARK_BODY,
  buildOwnerMatchEmail, claimProjectIds, developmentIdFromMatchRefKey, dropRepeatedAlerts, eventToChanges, groupOwnerDigests,
  matchRowPayload, matchStartFromEnv, ownerMarkedFor, priceFromIdsNeeded, submittedName, type OwnerLead,
} from "./matchGlue";
import { TRANSPORT_BREAKER, truncateError } from "./notify";

export { matchStartFromEnv };

const DAY = 86_400_000;

export type MatchRunResult = {
  today: string;
  changes: number;
  claims: number;
  planned: number;
  repeated: number;
  inserted: number;
  owners: { sent: number; failed: number; skipped: Record<string, number> };
  errors: string[];
  stoppedEarly?: string;
};

/** Advisory-lock key of the partner-match run ("PMAT"). */
const MATCH_LOCK_KEY = 0x504d4154;
const LOCK_HOLD_MS = 15 * 60_000;

/** Runs fn while holding the partner-match advisory lock (same pinned-transaction pattern as withDigestLock); null when taken. */
export async function withMatchLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${MATCH_LOCK_KEY}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { maxWait: 10_000, timeout: LOCK_HOLD_MS },
  );
}

type Loc = { district: string | null; town: string | null; area: string | null };
type DevRow = {
  id: string; priceFrom: number | null; district: string | null; town: string | null; area: string | null;
  override: { district: string | null; town: string | null; area: string | null } | null;
};
const locOf = (d: DevRow): Loc => ({
  district: d.override?.district || d.district || null,
  town: d.override?.town || d.town || null,
  area: d.override?.area || d.area || null,
});

/** Effectively ACTIVE claims (claimState.ts rule, evaluated in batch) whose lead has a budget and is still open. */
async function loadCandidateClaims(now: Date) {
  const rows = await prisma.partnerClaim.findMany({
    where: {
      state: "ACTIVE",
      createdAt: { lt: now },
      partner: { status: "ACTIVE" },
      lead: {
        deletedAt: null,
        status: { notIn: [...MATCH_EXCLUDED_LEAD_STATUSES] },
        OR: [{ budgetMin: { not: null } }, { budgetMax: { not: null } }],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: MATCH_CLAIM_CAP,
    select: {
      id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true, submission: true,
      lead: { select: { status: true, deletedAt: true, budgetMin: true, budgetMax: true } },
    },
  });
  if (!rows.length) return [];
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
  const liveDeals = await prisma.deal.groupBy({
    by: ["leadId"],
    where: { leadId: { in: leadIds }, commissionStatus: { not: "CANCELLED" } },
    _count: { _all: true },
  });
  const live = new Set(liveDeals.map((d) => d.leadId));
  const uncommitted = rows.filter((r) => !live.has(r.leadId) && !(COMMITTED_LEAD_STATUSES as readonly string[]).includes(r.lead.status));
  const contacts = uncommitted.length
    ? await prisma.leadInteraction.groupBy({
        by: ["leadId"],
        where: { leadId: { in: Array.from(new Set(uncommitted.map((r) => r.leadId))) }, type: { in: [...REAL_CONTACT_TYPES] } },
        _max: { occurredAt: true },
      })
    : [];
  const lastContact = new Map(contacts.map((c) => [c.leadId, c._max.occurredAt ?? null]));
  return rows.filter(
    (r) =>
      effectiveClaimState({
        state: r.state as ClaimStateValue,
        activeSince: activeSince(r),
        lastRealContactAt: lastContact.get(r.leadId) ?? null,
        now,
        leadDeleted: !!r.lead.deletedAt,
        leadStatus: r.lead.status,
        hasLiveDeal: live.has(r.leadId),
      }) === "ACTIVE",
  );
}

/**
 * One run: plans today's (Cyprus date) alerts from the last 24 h of catalogue changes, drops repeats of the
 * last 14 days, writes MATCH outbox rows (refKey unique → a rerun never doubles them), then mails each
 * lead owner the day's alerts on their leads. Nothing before `start` (PARTNER_MATCH_START).
 */
export async function runMatchAlerts(now: Date, start: Date): Promise<MatchRunResult> {
  const today = dayKey(now);
  const result: MatchRunResult = {
    today, changes: 0, claims: 0, planned: 0, repeated: 0, inserted: 0, owners: { sent: 0, failed: 0, skipped: {} }, errors: [],
  };
  if (now.getTime() < start.getTime()) {
    result.owners.skipped["before start"] = 1;
    return result;
  }

  const [changes, claimRows] = await Promise.all([
    inventoryChanges({ days: 1, now, types: MATCH_EVENT_TYPES, limit: MATCH_CHANGE_CAP }),
    loadCandidateClaims(now),
  ]);
  result.changes = changes.events.length;
  result.claims = claimRows.length;

  if (changes.events.length && claimRows.length) {
    // One development query: the claims' submitted projects (locations) and priceFrom for publish/back-on-market events.
    const projectIdsByClaim = new Map(claimRows.map((c) => [c.id, claimProjectIds(c.submission)]));
    const devIds = new Set<string>(priceFromIdsNeeded(changes.events));
    for (const ids of Array.from(projectIdsByClaim.values())) for (const id of ids) devIds.add(id);
    const devs: DevRow[] = devIds.size
      ? await prisma.development.findMany({
          where: { id: { in: Array.from(devIds) } },
          select: { id: true, priceFrom: true, district: true, town: true, area: true, override: { select: { district: true, town: true, area: true } } },
        })
      : [];
    const devById = new Map(devs.map((d) => [d.id, d]));
    const priceFromById = new Map(devs.map((d) => [d.id, d.priceFrom]));

    const planChanges = changes.events.flatMap((e) => eventToChanges(e, priceFromById));
    // Lead.projectInterest points to a legacy content Project, not a Development: it is not used as an anchor.
    const claims: MatchClaim[] = claimRows.map((c) => ({
      claimId: c.id,
      partnerId: c.partnerId,
      leadId: c.leadId,
      budgetMin: c.lead.budgetMin,
      budgetMax: c.lead.budgetMax,
      projects: (projectIdsByClaim.get(c.id) ?? []).flatMap((id): MatchProject[] => {
        const d = devById.get(id);
        return d ? [{ developmentId: d.id, ...locOf(d) }] : [];
      }),
      interest: null,
    }));
    const planned = planMatchAlerts({ claims, changes: planChanges, today });
    result.planned = planned.length;

    if (planned.length) {
      const recent = await prisma.partnerNotification.findMany({
        where: {
          kind: "MATCH",
          claimId: { in: Array.from(new Set(planned.map((p) => p.claimId))) },
          createdAt: { gte: new Date(now.getTime() - MATCH_DEDUPE_DAYS * DAY) },
        },
        select: { claimId: true, refKey: true, payload: true },
      });
      const { keep, repeated } = dropRepeatedAlerts(planned, recent);
      result.repeated = repeated;
      const nameByClaim = new Map(claimRows.map((c) => [c.id, submittedName(c.submission)]));
      if (keep.length) {
        const r = await prisma.partnerNotification.createMany({
          data: keep.map((a) => ({
            kind: "MATCH" as const, refKey: a.refKey, partnerId: a.partnerId, leadId: a.leadId, claimId: a.claimId,
            payload: matchRowPayload(a, nameByClaim.get(a.claimId) ?? ""),
          })),
          skipDuplicates: true,
        });
        result.inserted = r.count;
      }
    }
  }

  await mailOwners(now, today, result);
  return result;
}

const MARK_LOOKBACK_MS = 2 * DAY;

/**
 * One English e-mail per lead owner listing today's MATCH rows on their leads. Reads today's rows from
 * the outbox (so a failed owner mail is retried by a rerun the same day), skips leads already marked for
 * today, and marks each lead with a SYSTEM interaction only after its owner's mail went out (crm-sla pattern).
 */
async function mailOwners(now: Date, today: string, result: MatchRunResult): Promise<void> {
  const rows = (
    await prisma.partnerNotification.findMany({
      where: { kind: "MATCH", refKey: { endsWith: `:${today}` }, createdAt: { gte: new Date(now.getTime() - MARK_LOOKBACK_MS) } },
      orderBy: { createdAt: "asc" },
      take: MATCH_CLAIM_CAP * 3,
      select: { leadId: true, partnerId: true, refKey: true, payload: true },
    })
  ).flatMap((r) => {
    const developmentId = developmentIdFromMatchRefKey(r.refKey);
    return r.leadId && developmentId ? [{ leadId: r.leadId, partnerId: r.partnerId, developmentId, payload: r.payload }] : [];
  });
  if (!rows.length) return;

  const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
  const partnerIds = Array.from(new Set(rows.map((r) => r.partnerId)));
  const [leads, partners] = await Promise.all([
    prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: {
        id: true, firstName: true, lastName: true,
        assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
        interactions: {
          where: { type: "SYSTEM", body: OWNER_MARK_BODY, occurredAt: { gte: new Date(now.getTime() - MARK_LOOKBACK_MS) } },
          select: { metadata: true },
        },
      },
    }),
    prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, company: true, firstName: true, lastName: true } }),
  ]);
  const leadMap = new Map<string, OwnerLead>(
    leads.map((l) => [l.id, {
      id: l.id,
      name: `${l.firstName} ${l.lastName}`.trim(),
      owner: l.assignedTo,
      markedToday: l.interactions.some((i) => ownerMarkedFor(i.metadata, today)),
    }]),
  );
  const partnerLabels = new Map(partners.map((p) => [p.id, p.company?.trim() || `${p.firstName} ${p.lastName}`.trim()]));
  const { digests, skipped } = groupOwnerDigests({ rows, leads: leadMap, partnerLabels });
  result.owners.skipped = skipped;
  if (!digests.length) return;

  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  let streak = 0;
  for (const d of digests) {
    const mail = buildOwnerMatchEmail(d, base, today);
    try {
      await sendEmail({ to: d.email, subject: mail.subject, text: mail.text, html: mail.html });
    } catch (e) {
      result.owners.failed++;
      result.errors.push(`owner ${d.ownerId}: ${truncateError(e)}`);
      if (++streak >= TRANSPORT_BREAKER) {
        result.stoppedEarly = "mail transport failing";
        break;
      }
      continue;
    }
    streak = 0;
    result.owners.sent++;
    try {
      await prisma.leadInteraction.createMany({
        data: d.leadIds.map((leadId) => ({
          leadId, type: "SYSTEM" as const, channel: "SYSTEM" as const, body: OWNER_MARK_BODY,
          metadata: { partnerMatch: today, developmentIds: d.developmentIdsByLead[leadId] ?? [] },
        })),
      });
    } catch (e) {
      // The mail went out; an unmarked lead may be mailed once more by a rerun today.
      result.errors.push(`owner ${d.ownerId}: sent but could not mark: ${truncateError(e)}`);
    }
  }
}
