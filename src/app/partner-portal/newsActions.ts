"use server";
/** Phase 4b: the partner opened /news. Writes only the session partner's own newsSeenAt (never during render). */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner/session";

export async function markNewsSeenAction(): Promise<void> {
  const me = await requirePartner({ active: true });
  await prisma.partner.update({ where: { id: me.partner.id }, data: { newsSeenAt: new Date() } });
  // The unread badge lives in the portal layout (nav): revalidate the whole portal, not only /news.
  revalidatePath("/partner-portal", "layout");
}
