"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { writeAudit } from "@/lib/crm/audit";
import { parseRate } from "@/lib/crm/rateForm";
import { isIdArg, isPayoutAction, parseStageDate, payoutActions, stageOrderError, type PayoutAction } from "@/lib/crm/commissionActions";
import type { CommissionStatusValue } from "@/lib/crm/commission";

// Commissions screen writes (CRM v2, 2026-10-18). Money records: every write and
// its audit row commit in one transaction. Changing a rate never touches
// existing deals — they keep the rate stored on them when they were created.

type Result = { ok: true } | { error: string };
const DENIED = { error: "Only admins can change commissions." } as const;

async function manager() {
  const actor = await requireCrmUser();
  return canAssignLeads(actor) ? actor : null;
}

export async function saveRateAction(input: { developerAccountId: string; developmentId: string | null; rate: string }): Promise<Result> {
  const actor = await manager();
  if (!actor) return DENIED;
  const developerAccountId: unknown = input?.developerAccountId;
  const developmentId: unknown = input?.developmentId === "" ? null : input?.developmentId ?? null;
  if (!isIdArg(developerAccountId)) return { error: "Developer account missing — reload." };
  if (developmentId !== null && !isIdArg(developmentId)) return { error: "Project not recognised — reload." };
  const parsed = parseRate(String(input?.rate ?? ""));
  if (!parsed.ok) return { error: parsed.error };

  const account = await prisma.developerAccount.findUnique({ where: { id: developerAccountId }, select: { id: true } });
  if (!account) return { error: "Developer account not found — reload." };
  if (developmentId) {
    const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { developerAccountId: true } });
    if (!dev || dev.developerAccountId !== developerAccountId) return { error: "That project does not belong to this developer." };
  }

  const after = parsed.value.toFixed(2);
  try {
    await prisma.$transaction(async (tx) => {
      // The "one default per account" rule is a partial unique index that exists
      // only in SQL, so the default row is found and updated by hand; a parallel
      // create loses on the index and lands in the catch below.
      const existing = developmentId
        ? await tx.commissionRate.findUnique({ where: { developmentId } })
        : await tx.commissionRate.findFirst({ where: { developerAccountId, developmentId: null } });
      const before = existing ? existing.ratePercent.toFixed(2) : null;
      if (existing && before === after && existing.developerAccountId === developerAccountId) return;
      const row = existing
        ? await tx.commissionRate.update({ where: { id: existing.id }, data: { ratePercent: after, developerAccountId } })
        : await tx.commissionRate.create({ data: { developerAccountId, developmentId, ratePercent: after } });
      await writeAudit(actor, "crm_rate_save", "CommissionRate", row.id, { developerAccountId, developmentId, before, after }, tx);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Someone else just saved this rate — reload." };
    // The row was deleted between our read and the update.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { error: "This rate no longer exists — reload." };
    throw e;
  }
  revalidatePath("/crm/commissions");
  return { ok: true };
}

export async function deleteRateAction(rateId: string): Promise<Result> {
  const actor = await manager();
  if (!actor) return DENIED;
  if (!isIdArg(rateId)) return { error: "Rate not recognised — reload." };
  let deleted: boolean;
  try {
    deleted = await prisma.$transaction(async (tx) => {
      const row = await tx.commissionRate.findUnique({ where: { id: rateId } });
      if (!row) return false;
      await tx.commissionRate.delete({ where: { id: rateId } });
      await writeAudit(actor, "crm_rate_delete", "CommissionRate", rateId, {
        developerAccountId: row.developerAccountId, developmentId: row.developmentId, ratePercent: row.ratePercent.toFixed(2), note: row.note,
      }, tx);
      return true;
    });
  } catch (e) {
    // A parallel delete won between our read and our delete. (A delete cannot
    // hit a unique index, so P2002 needs no mapping here.)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") deleted = false;
    else throw e;
  }
  if (!deleted) return { error: "This rate no longer exists — reload." };
  revalidatePath("/crm/commissions");
  return { ok: true };
}

const STAGE_FIELD: Record<PayoutAction, "developerPaidAt" | "paidOutAt" | "cancelledAt"> = {
  DEVELOPER_PAID: "developerPaidAt",
  PAID_OUT: "paidOutAt",
  CANCELLED: "cancelledAt",
};

export async function setDealStageAction(dealId: string, to: PayoutAction, onDate: string): Promise<Result> {
  const actor = await manager();
  if (!actor) return DENIED;
  if (!isIdArg(dealId)) return { error: "Deal not recognised — reload." };
  if (!isPayoutAction(to)) return { error: "Unknown payout step." };
  const date = parseStageDate(String(onDate ?? ""));
  if (!date.ok) return { error: date.error };

  const result = await prisma.$transaction(async (tx): Promise<Result & { leadId?: string }> => {
    // Lock the row so two clicks (or two people) cannot both move the same deal.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM deals WHERE id = ${dealId} FOR UPDATE`;
    if (locked.length === 0) return { error: "Deal not found — reload." };
    const deal = await tx.deal.findUniqueOrThrow({
      where: { id: dealId },
      select: { leadId: true, commissionStatus: true, earnedAt: true, developerPaidAt: true },
    });
    const from = deal.commissionStatus as CommissionStatusValue;
    if (!payoutActions(from).includes(to)) return { error: `This deal is now ${from.toLowerCase().replace("_", " ")} — reload.` };
    const orderError = stageOrderError(to, onDate, deal);
    if (orderError) return { error: orderError };
    await tx.deal.update({ where: { id: dealId }, data: { commissionStatus: to, [STAGE_FIELD[to]]: date.value } });
    await writeAudit(actor, "crm_deal_stage", "Deal", dealId, { leadId: deal.leadId, from, to, date: onDate }, tx);
    return { ok: true, leadId: deal.leadId };
  });
  if ("error" in result) return { error: result.error };
  revalidatePath("/crm/commissions");
  revalidatePath("/crm/pipeline");
  if (result.leadId) revalidatePath(`/crm/leads/${result.leadId}`);
  return { ok: true };
}
