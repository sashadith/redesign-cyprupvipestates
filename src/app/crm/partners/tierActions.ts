"use server";
// Partner tiers in the CRM (phase 4b, Decision 4): tier settings, Accept / Decline of open proposals, and the
// manual tier change per partner.
// Managers only (canAssignLeads). Every write is audited in the same transaction.
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { writeAudit } from "@/lib/crm/audit";
import {
  manualTierChange, mergeTierEdits, parseTierEdits, tierAcceptData, tierConfigDiff, tierUpManualRefKey, tierUpPayload, tierUpRefKey,
} from "@/lib/partner/tierFlow";
import { validateTierConfig } from "@/lib/partner/tiers";
import { loadTiers } from "@/lib/partner/tierStore";

type Result = { ok: true; notice?: string } | { error: string };
const DENIED = "Only managers can manage partner tiers";

async function guard() {
  const actor = await requireCrmUser();
  return canAssignLeads(actor) ? actor : null;
}

/** Raised inside a transaction to roll it back with a message for the operator. */
class Refusal extends Error {}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

/** Saves all tier rows at once (name, threshold, shares, active). The sort order is not editable here. */
export async function saveTierConfigAction(rows: unknown): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  const parsed = parseTierEdits(rows);
  if ("error" in parsed) return parsed;
  try {
    const outcome = await prisma.$transaction(async (tx): Promise<"unchanged" | "saved"> => {
      // Two managers saving at once: the second waits and validates against the first one's result.
      await tx.$queryRaw`SELECT key FROM partner_tiers FOR UPDATE`;
      const current = await loadTiers(tx);
      const merged = mergeTierEdits(current, parsed.rows);
      if ("error" in merged) throw new Refusal(merged.error);
      const errors = validateTierConfig(merged.rows);
      if (errors.length) throw new Refusal(errors.join(" "));
      const diff = tierConfigDiff(current, merged.rows);
      if (!diff.changed.length) return "unchanged";
      for (const t of diff.changed) {
        await tx.partnerTier.update({
          where: { key: t.key },
          data: { name: t.name.trim(), minClosedDeals: t.minClosedDeals, handoverShare: t.handoverShare, fixShare: t.fixShare, active: t.active },
        });
      }
      await writeAudit(actor, "partner_tiers_update", "partner_tier", diff.changed.map((t) => t.key).join(","), { before: diff.before, after: diff.after }, tx);
      return "saved";
    });
    if (outcome === "unchanged") return { ok: true, notice: "No changes" };
  } catch (e) {
    if (e instanceof Refusal) return { error: e.message };
    throw e;
  }
  revalidatePath("/crm/partners");
  return { ok: true, notice: "Tiers saved" };
}

type LockedPartner = { tierKey: string | null; handoverShare: number; fixShare: number };
const lockPartner = async (tx: Prisma.TransactionClient, id: string) =>
  (await tx.$queryRaw<LockedPartner[]>`
    SELECT "tierKey", "handoverShare"::float8 AS "handoverShare", "fixShare"::float8 AS "fixShare" FROM partners WHERE id = ${id} FOR UPDATE`)[0];

/**
 * Accepts an open proposal: closes it (guarded, only while undecided), sets the partner's tier and tier date,
 * raises each share to the tier's share as it is now (never lowers one; the tier must be active), audits, and
 * queues the TIER_UP notification with the resulting shares. Existing deals keep their share; only deals
 * created afterwards use the new one.
 */
export async function acceptTierProposalAction(proposalId: string): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  if (!validId(proposalId)) return { error: "Proposal not found." };
  let tierName = "";
  try {
    const outcome = await prisma.$transaction(async (tx): Promise<"missing" | "decided" | "done"> => {
      const now = new Date();
      const r = await tx.partnerTierProposal.updateMany({
        where: { id: proposalId, decidedAt: null },
        data: { decision: "ACCEPTED", decidedAt: now, decidedById: actor.id },
      });
      if (r.count !== 1) {
        const exists = await tx.partnerTierProposal.findUnique({ where: { id: proposalId }, select: { id: true } });
        return exists ? "decided" : "missing";
      }
      const proposal = await tx.partnerTierProposal.findUniqueOrThrow({
        where: { id: proposalId }, select: { partnerId: true, toTier: true, closedDeals: true },
      });
      const before = await lockPartner(tx, proposal.partnerId);
      if (!before) throw new Refusal("Partner not found.");
      const tiers = await loadTiers(tx);
      const tier = tiers.find((t) => t.key === proposal.toTier) ?? null;
      const current = tiers.find((t) => t.key === before.tierKey) ?? null;
      const accepted = tierAcceptData(tier, now, current, { handoverShare: before.handoverShare, fixShare: before.fixShare });
      if ("error" in accepted) throw new Refusal(accepted.error);
      await tx.partner.update({ where: { id: proposal.partnerId }, data: accepted.data });
      await writeAudit(actor, "partner_tier_accept", "partner", proposal.partnerId, {
        proposalId,
        closedDeals: proposal.closedDeals,
        before: { tierKey: before.tierKey, handoverShare: before.handoverShare, fixShare: before.fixShare },
        after: { tierKey: accepted.data.tierKey, handoverShare: accepted.data.handoverShare, fixShare: accepted.data.fixShare },
      }, tx);
      await tx.partnerNotification.create({
        data: { kind: "TIER_UP", refKey: tierUpRefKey(proposalId), partnerId: proposal.partnerId, payload: tierUpPayload(tier!, accepted.data) },
      });
      tierName = tier!.name;
      return "done";
    });
    if (outcome === "missing") return { error: "Proposal not found." };
    if (outcome === "decided") return { error: "Already decided by someone else." };
  } catch (e) {
    if (e instanceof Refusal) return { error: e.message };
    throw e;
  }
  revalidatePath("/crm/partners");
  return { ok: true, notice: `Accepted — partner is now ${tierName}` };
}

/** Declines an open proposal (guarded). The cron proposes again only once the closed-deal count exceeds this one's. */
export async function declineTierProposalAction(proposalId: string): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  if (!validId(proposalId)) return { error: "Proposal not found." };
  const outcome = await prisma.$transaction(async (tx): Promise<"missing" | "decided" | "done"> => {
    const now = new Date();
    const r = await tx.partnerTierProposal.updateMany({
      where: { id: proposalId, decidedAt: null },
      data: { decision: "DECLINED", decidedAt: now, decidedById: actor.id },
    });
    if (r.count !== 1) {
      const exists = await tx.partnerTierProposal.findUnique({ where: { id: proposalId }, select: { id: true } });
      return exists ? "decided" : "missing";
    }
    const p = await tx.partnerTierProposal.findUniqueOrThrow({
      where: { id: proposalId }, select: { partnerId: true, fromTier: true, toTier: true, closedDeals: true },
    });
    await writeAudit(actor, "partner_tier_decline", "partner", p.partnerId, {
      proposalId, fromTier: p.fromTier, toTier: p.toTier, closedDeals: p.closedDeals,
    }, tx);
    return "done";
  });
  if (outcome === "missing") return { error: "Proposal not found." };
  if (outcome === "decided") return { error: "Already decided by someone else." };
  revalidatePath("/crm/partners");
  return { ok: true, notice: "Declined" };
}

/**
 * Sets a partner's tier by hand (or "none" = back to the default). A chosen tier brings exactly its shares
 * (explicit operator choice, may lower them); "none" leaves the shares alone. Audited as partner_tier_manual;
 * an upgrade queues a TIER_UP notice, a downgrade or "none" does not. Open proposals stay; Accept refuses
 * one that is no longer an upgrade.
 */
export async function setPartnerTierAction(partnerId: string, tierKey: string | null): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  if (!validId(partnerId)) return { error: "Partner not found." };
  if (tierKey !== null && !validId(tierKey)) return { error: "This tier does not exist." };
  let notice = "";
  try {
    const outcome = await prisma.$transaction(async (tx): Promise<"unchanged" | "done"> => {
      const now = new Date();
      const before = await lockPartner(tx, partnerId);
      if (!before) throw new Refusal("Partner not found.");
      const tiers = await loadTiers(tx);
      const change = manualTierChange({
        currentKey: before.tierKey, targetKey: tierKey, shares: { handoverShare: before.handoverShare, fixShare: before.fixShare }, tiers, now,
      });
      if ("error" in change) throw new Refusal(change.error);
      if ("unchanged" in change) return "unchanged";
      await tx.partner.update({ where: { id: partnerId }, data: change.data });
      const after = {
        tierKey: change.data.tierKey,
        handoverShare: change.data.handoverShare ?? before.handoverShare,
        fixShare: change.data.fixShare ?? before.fixShare,
      };
      await writeAudit(actor, "partner_tier_manual", "partner", partnerId, {
        direction: change.direction,
        before: { tierKey: before.tierKey, handoverShare: before.handoverShare, fixShare: before.fixShare },
        after,
      }, tx);
      if (change.direction === "up" && change.tier) {
        await tx.partnerNotification.create({
          data: { kind: "TIER_UP", refKey: tierUpManualRefKey(partnerId, now), partnerId, payload: tierUpPayload(change.tier, after) },
        });
      }
      notice = change.tier
        ? `Tier set to ${change.tier.name} (Handover ${after.handoverShare}% · Fix ${after.fixShare}%)${change.direction === "up" ? " — partner notified" : ""}`
        : "Tier cleared — the partner falls back to the default tier; shares unchanged";
      return "done";
    });
    if (outcome === "unchanged") return { ok: true, notice: "No changes" };
  } catch (e) {
    if (e instanceof Refusal) return { error: e.message };
    throw e;
  }
  revalidatePath("/crm/partners");
  return { ok: true, notice };
}
