"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { isRightsImmune, normalizeRights, validateTeamPatch } from "@/lib/crm/teamRights";
import { writeAudit } from "@/lib/crm/audit";

export type TeamStored = { canSeeColleagues: boolean; canEditColleagues: boolean; languages: string[]; specialties: string[]; acceptsLeads: boolean };

export async function updateTeamMemberAction(userId: string, raw: unknown): Promise<{ ok: true; stored: TeamStored } | { error: string }> {
  const actor = await requireCrmUser();
  if (!canAssignLeads(actor)) return { error: "Only admins can change team settings." };
  const v = validateTeamPatch(raw);
  if (!v.ok) return { error: v.error };
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isOwner: true, canSeeColleagues: true, canEditColleagues: true, languages: true, specialties: true, acceptsLeads: true },
  });
  if (!target) return { error: "Employee not found." };
  const touchesRights = v.patch.canSeeColleagues !== undefined || v.patch.canEditColleagues !== undefined;
  if (touchesRights && isRightsImmune(target)) return { error: "Admins always see everything." };
  const before: TeamStored = { canSeeColleagues: target.canSeeColleagues, canEditColleagues: target.canEditColleagues, languages: target.languages, specialties: target.specialties, acceptsLeads: target.acceptsLeads };
  const data: Partial<TeamStored> = { ...v.patch, ...(touchesRights ? normalizeRights(target, v.patch) : {}) };
  const after: TeamStored = { ...before, ...data };
  if (JSON.stringify(after) === JSON.stringify(before)) return { ok: true, stored: before };
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data });
    await writeAudit(actor, "crm_team_update", "User", userId, { before, after: data }, tx);
  });
  revalidatePath("/crm/team");
  return { ok: true, stored: after };
}
