"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { writeAudit } from "@/lib/crm/audit";
import { revokeAllSessionsForPartner } from "@/lib/partner/session";
import { buildApprovedEmail, partnerBaseUrl } from "@/lib/partner/mail";
import { asLocale } from "@/lib/partner/accounts";
import { newRefCode, randomSuffix } from "@/lib/partner/refCode";
import { parseTerms } from "@/lib/partner/terms";
import { sendEmail } from "@/lib/sendEmail";

type Result = { ok: true; notice?: string } | { error: string };
const DENIED = "Only admins can manage partners.";

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
    const r = await tx.partner.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    if (r.count !== 1) return false;
    await writeAudit(actor, "partner_suspend", "partner", id, { before: { status: "ACTIVE" }, after: { status: "SUSPENDED" } }, tx);
    return true;
  });
  if (!done) return { error: "Only active partners can be suspended." };
  await revokeAllSessionsForPartner(id);
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
  const cur = await prisma.partner.findUnique({ where: { id }, select: { handoverShare: true, fixShare: true, trustMode: true, managerUserId: true } });
  if (!cur) return { error: "Partner not found." };
  const before = { handoverShare: Number(cur.handoverShare), fixShare: Number(cur.fixShare), trustMode: cur.trustMode, managerUserId: cur.managerUserId };
  const keys = Object.keys(t) as (keyof typeof t)[];
  const changed = keys.filter((k) => before[k] !== t[k]);
  if (changed.length === 0) return { ok: true, notice: "No changes" };
  await prisma.$transaction(async (tx) => {
    await tx.partner.update({ where: { id }, data: t });
    await writeAudit(actor, "partner_terms_update", "partner", id, {
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, t[k]])),
    }, tx);
  });
  revalidatePath("/crm/partners");
  return { ok: true, notice: "Saved" };
}
