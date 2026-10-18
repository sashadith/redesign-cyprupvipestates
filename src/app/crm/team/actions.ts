"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { normalizeRights, validateTeamPatch } from "@/lib/crm/teamRights";
import { writeAudit } from "@/lib/crm/audit";

export async function updateTeamMemberAction(userId: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
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
  if (touchesRights && (target.isOwner || target.role === "ADMIN")) return { error: "Admins always see everything." };
  const rights = normalizeRights(target, v.patch);
  const data = { ...v.patch, ...(touchesRights ? rights : {}) };
  await prisma.user.update({ where: { id: userId }, data });
  await writeAudit(actor, "crm_team_update", "User", userId, {
    before: { canSeeColleagues: target.canSeeColleagues, canEditColleagues: target.canEditColleagues, languages: target.languages, specialties: target.specialties, acceptsLeads: target.acceptsLeads },
    after: data,
  });
  revalidatePath("/crm/team");
  return { ok: true };
}
