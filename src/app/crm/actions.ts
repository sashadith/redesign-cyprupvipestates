"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { isLeadStatus, LOST_REASONS, type LostReasonValue } from "@/lib/crm/leadStatus";
import { moveLead, type DealInput, type MoveResult } from "@/lib/crm/moveLead";

export async function moveLeadAction(
  leadId: string,
  to: string,
  rawInput: { deal?: DealInput; lostReason?: string; confirmCancel?: boolean } | null = {},
): Promise<MoveResult> {
  const user = await requireCrmUser();
  if (!isLeadStatus(to)) return { error: "Unknown stage." };
  const input = rawInput ?? {};
  let deal: DealInput | undefined;
  if (input.deal != null) {
    const d = input.deal as Partial<DealInput>;
    const label = d.unitLabel == null ? null : typeof d.unitLabel === "string" ? d.unitLabel.trim() : undefined;
    if (
      typeof d.developmentId !== "string" || !d.developmentId || d.developmentId.length > 64 ||
      label === undefined || (label !== null && label.length > 40) ||
      typeof d.price !== "number" || !Number.isInteger(d.price)
    ) {
      return { error: "Enter the deal: project, unit and price.", need: "deal" };
    }
    deal = { developmentId: d.developmentId, unitLabel: label || null, price: d.price };
  }
  const lostReason = input.lostReason && (LOST_REASONS as readonly string[]).includes(input.lostReason) ? (input.lostReason as LostReasonValue) : undefined;
  const res = await moveLead(user, leadId, to, { deal, lostReason, confirmCancel: input.confirmCancel === true });
  if ("ok" in res) revalidatePath("/crm/pipeline");
  return res;
}

export async function searchDevelopmentsAction(q: string): Promise<{ id: string; label: string }[]> {
  await requireCrmUser();
  const term = q.trim();
  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", ...(term ? { publicName: { contains: term, mode: "insensitive" } } : {}) },
    orderBy: { publicName: "asc" },
    take: 20,
    select: { id: true, publicName: true, town: true },
  });
  return rows.map((r) => ({ id: r.id, label: r.town ? `${r.publicName} · ${r.town}` : r.publicName }));
}
