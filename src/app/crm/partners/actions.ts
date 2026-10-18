"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { writeAudit } from "@/lib/crm/audit";
import { buildApprovedEmail, partnerBaseUrl } from "@/lib/partner/mail";
import { asLocale } from "@/lib/partner/accounts";
import { newRefCode, randomSuffix } from "@/lib/partner/refCode";
import { parseTerms } from "@/lib/partner/terms";
import { sendEmail } from "@/lib/sendEmail";
import { isVatMode } from "@/lib/crm/payoutRules";
import { decryptBankDetails } from "@/lib/partner/bankCrypto";
import type { BankDetails } from "@/lib/partner/bank";

type Result = { ok: true; notice?: string } | { error: string };
const DENIED = "Only managers can manage partners";

async function guard() {
  const actor = await requireCrmUser();
  return canAssignLeads(actor) ? actor : null;
}

export async function approvePartnerAction(id: string): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      id: true, status: true, firstName: true, lastName: true, company: true, language: true, refCode: true,
      users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true, emailVerifiedAt: true } },
    },
  });
  if (!partner) return { error: "Partner not found." };
  if (partner.status === "ACTIVE") return { error: "Already active" };
  if (partner.status !== "PENDING") return { error: "Only pending partners can be approved. Use Reactivate." };
  const pu = partner.users[0];
  if (!pu) return { error: "Partner has no login user." };
  if (!pu.emailVerifiedAt) return { error: "Email not verified yet" };

  let committed = false;
  for (let attempt = 0; attempt < 5 && !committed; attempt++) {
    const refCode = partner.refCode ?? newRefCode({ company: partner.company, lastName: partner.lastName }, randomSuffix);
    try {
      const done = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const r = await tx.partner.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "ACTIVE", approvedAt: now, approvedById: actor.id, suspendedAt: null, refCode },
        });
        if (r.count !== 1) return false;
        await writeAudit(actor, "partner_approve", "partner", id, {
          before: { status: "PENDING", refCode: partner.refCode },
          after: { status: "ACTIVE", refCode, approvedById: actor.id },
        }, tx);
        return true;
      });
      if (!done) return { error: "Already handled by someone else." };
      committed = true;
    } catch (e) {
      const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!collision || partner.refCode) throw e;
    }
  }
  if (!committed) return { error: "Could not generate a unique ref code. Try again." };
  revalidatePath("/crm/partners");

  try {
    const mail = buildApprovedEmail(asLocale(partner.language), partner.firstName, `${partnerBaseUrl()}/login`);
    await sendEmail({ to: pu.email, subject: mail.subject, text: mail.text, html: mail.html });
    return { ok: true, notice: "Approved — email sent" };
  } catch (e) {
    console.error("[partner] approved email failed", e);
    return { ok: true, notice: "Approved — email could not be sent" };
  }
}

export async function suspendPartnerAction(id: string): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  const done = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const r = await tx.partner.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "SUSPENDED", suspendedAt: now } });
    if (r.count !== 1) return false;
    // Same transaction: the partner is never SUSPENDED while still holding a live session.
    await tx.partnerSession.updateMany({ where: { partnerUser: { partnerId: id }, revokedAt: null }, data: { revokedAt: now } });
    await writeAudit(actor, "partner_suspend", "partner", id, { before: { status: "ACTIVE" }, after: { status: "SUSPENDED" } }, tx);
    return true;
  });
  if (!done) return { error: "Only active partners can be suspended." };
  revalidatePath("/crm/partners");
  return { ok: true, notice: "Suspended" };
}

export async function reactivatePartnerAction(id: string): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.partner.updateMany({ where: { id, status: "SUSPENDED" }, data: { status: "ACTIVE", suspendedAt: null } });
    if (r.count !== 1) return false;
    await writeAudit(actor, "partner_reactivate", "partner", id, { before: { status: "SUSPENDED" }, after: { status: "ACTIVE" } }, tx);
    return true;
  });
  if (!done) return { error: "Only suspended partners can be reactivated." };
  revalidatePath("/crm/partners");
  return { ok: true, notice: "Reactivated" };
}

export async function updatePartnerTermsAction(id: string, raw: unknown): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  const v = parseTerms(raw);
  if (!v.ok) return { error: v.error };
  const t = v.value;
  if (t.managerUserId) {
    const m = await prisma.user.findFirst({ where: { id: t.managerUserId, isActive: true }, select: { id: true } });
    if (!m) return { error: "Manager must be an active employee." };
  }
  type Outcome = "missing" | "unchanged" | "saved";
  let outcome: Outcome;
  try {
    // Read and write in one transaction, so the audit "before" is the row actually overwritten.
    outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const cur = await tx.partner.findUnique({ where: { id }, select: { handoverShare: true, fixShare: true, trustMode: true, managerUserId: true } });
      if (!cur) return "missing";
      const before = { handoverShare: Number(cur.handoverShare), fixShare: Number(cur.fixShare), trustMode: cur.trustMode, managerUserId: cur.managerUserId };
      const keys = Object.keys(t) as (keyof typeof t)[];
      const changed = keys.filter((k) => before[k] !== t[k]);
      if (changed.length === 0) return "unchanged";
      await tx.partner.update({ where: { id }, data: t });
      await writeAudit(actor, "partner_terms_update", "partner", id, {
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, t[k]])),
      }, tx);
      return "saved";
    });
  } catch (e) {
    // Deleted between the read and the update.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { error: "Partner not found." };
    throw e;
  }
  if (outcome === "missing") return { error: "Partner not found." };
  if (outcome === "unchanged") return { ok: true, notice: "No changes" };
  revalidatePath("/crm/partners");
  return { ok: true, notice: "Saved" };
}

/** VAT treatment on the partner's credit notes — set by the office, never by the partner. Audited (vatMode only). */
export async function updatePartnerVatModeAction(id: string, mode: unknown): Promise<Result> {
  const actor = await guard();
  if (!actor) return { error: DENIED };
  if (typeof id !== "string" || !id || id.length > 64) return { error: "Partner not found." };
  if (!isVatMode(mode)) return { error: "Unknown VAT mode." };
  const outcome = await prisma.$transaction(async (tx): Promise<"missing" | "unchanged" | "saved"> => {
    const rows = await tx.$queryRaw<{ vatMode: string }[]>`SELECT "vatMode"::text AS "vatMode" FROM partners WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0) return "missing";
    const before = rows[0].vatMode;
    if (before === mode) return "unchanged";
    await tx.partner.update({ where: { id }, data: { vatMode: mode } });
    await writeAudit(actor, "partner_vat_mode_update", "partner", id, { before: { vatMode: before }, after: { vatMode: mode } }, tx);
    return "saved";
  });
  if (outcome === "missing") return { error: "Partner not found." };
  if (outcome === "unchanged") return { ok: true, notice: "No changes" };
  revalidatePath("/crm/partners");
  return { ok: true, notice: "VAT mode saved" };
}

/**
 * Full bank details for the owner only, once per click (nothing cached client-side).
 * The owner right is read from the DB (requireCrmUser). Audit without any values.
 */
export async function revealBankDetailsAction(partnerId: string): Promise<{ ok: true; details: BankDetails } | { error: string }> {
  const actor = await requireCrmUser();
  if (!actor.isActive || !actor.isOwner) return { error: "Only the owner can view full bank details." };
  if (typeof partnerId !== "string" || !partnerId || partnerId.length > 64) return { error: "Partner not found." };
  const p = await prisma.partner.findUnique({ where: { id: partnerId }, select: { bankDetailsEnc: true } });
  if (!p) return { error: "Partner not found." };
  if (!p.bankDetailsEnc) return { error: "This partner has not entered bank details yet." };
  let details: BankDetails;
  try {
    details = decryptBankDetails(p.bankDetailsEnc);
  } catch {
    return { error: "Bank details could not be decrypted — check the encryption key configuration." };
  }
  await writeAudit(actor, "partner.bank_viewed", "partner", partnerId, {});
  return { ok: true, details };
}
