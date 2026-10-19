"use server";
// Rating seasons in the CRM (phase 4b, Decision 6): create / edit a season (name, Cyprus days, point rules,
// prizes per locale). Managers only (canAssignLeads). Every write is audited in the same transaction.
// Overlapping seasons are allowed; the result carries a warning naming them.
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { writeAudit } from "@/lib/crm/audit";
import { overlappingSeasons, parseSeasonForm, seasonLockError } from "@/lib/partner/ratingFlow";

type Result = { ok: true; id: string; notice: string; warning?: string } | { error: string };
const DENIED = "Only managers can manage rating seasons";
const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

/**
 * Creates (no id) or updates a season. Once the season has point events, its dates and point rules are
 * frozen (seasonLockError); the name and prizes stay editable.
 */
export async function saveSeasonAction(id: string | null, form: unknown): Promise<Result> {
  const actor = await requireCrmUser();
  if (!canAssignLeads(actor)) return { error: DENIED };
  if (id !== null && !validId(id)) return { error: "Season not found." };
  const v = parseSeasonForm(form);
  if (!v.ok) return { error: v.errors.join(" ") };
  const s = v.value;
  const data = {
    name: s.name, startsAt: s.startsAt, endsAt: s.endsAt,
    pointRules: s.pointRules as unknown as Prisma.InputJsonValue, prizes: s.prizes as unknown as Prisma.InputJsonValue,
  };
  const detail = { name: s.name, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), pointRules: s.pointRules, prizes: s.prizes };

  const saved = await prisma.$transaction(async (tx): Promise<string | null | { locked: string }> => {
    if (id === null) {
      const row = await tx.ratingSeason.create({ data, select: { id: true } });
      await writeAudit(actor, "rating_season_create", "rating_season", row.id, detail, tx);
      return row.id;
    }
    const before = await tx.ratingSeason.findUnique({ where: { id }, select: { name: true, startsAt: true, endsAt: true, pointRules: true, prizes: true } });
    if (!before) return null;
    const hasEvents = !!(await tx.partnerPointEvent.findFirst({ where: { seasonId: id }, select: { id: true } }));
    const locked = seasonLockError(before, s, hasEvents);
    if (locked) return { locked };
    await tx.ratingSeason.update({ where: { id }, data });
    await writeAudit(actor, "rating_season_update", "rating_season", id, {
      before: { ...before, startsAt: before.startsAt.toISOString(), endsAt: before.endsAt.toISOString() }, after: detail,
    }, tx);
    return id;
  });
  if (!saved) return { error: "Season not found." };
  if (typeof saved !== "string") return { error: saved.locked };

  const others = await prisma.ratingSeason.findMany({ where: { id: { not: saved } }, select: { id: true, name: true, startsAt: true, endsAt: true }, take: 200 });
  const overlaps = overlappingSeasons(s, others, saved);
  revalidatePath("/crm/partners/rating");
  return {
    ok: true, id: saved, notice: id === null ? "Season created" : "Season saved",
    warning: overlaps.length ? `Overlaps with: ${overlaps.map((o) => o.name).join(", ")}. Partners see the one ending soonest.` : undefined,
  };
}
