// Server half of the landing response-time line (partner portal phase 3d). Pure parts: responseAverage.ts.
// Bounded (500 claims, one groupBy) and cached for an hour; a DB error hides the line, never the page.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { OUTBOUND_CONTACT_TYPES } from "./clientDto";
import { RESPONSE_CLAIM_CAP, RESPONSE_WINDOW_DAYS, averageResponse, responseMinutesFrom } from "./responseAverage";

export const RESPONSE_AVG_TAG = "partner-response-avg";

async function computeResponseAverage(): Promise<number | null> {
  const since = new Date(Date.now() - RESPONSE_WINDOW_DAYS * 86_400_000);
  // A rejected claim was a known contact: the team's contact with that lead says nothing about referrals.
  const claims = await prisma.partnerClaim.findMany({
    where: { createdAt: { gte: since }, state: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    take: RESPONSE_CLAIM_CAP,
    select: { leadId: true, createdAt: true },
  });
  if (!claims.length) return null;
  const firsts = await prisma.leadInteraction.groupBy({
    by: ["leadId"],
    where: {
      OR: claims.map((c) => ({ leadId: c.leadId, occurredAt: { gte: c.createdAt } })),
      type: { in: [...OUTBOUND_CONTACT_TYPES] },
    },
    _min: { occurredAt: true },
  });
  const map = new Map<string, Date>();
  for (const f of firsts) if (f._min.occurredAt) map.set(f.leadId, f._min.occurredAt);
  return averageResponse(responseMinutesFrom(claims, map));
}

const cached = unstable_cache(computeResponseAverage, ["partner-response-avg-v1"], {
  revalidate: 3600,
  tags: [RESPONSE_AVG_TAG],
});

/** Average minutes to first outbound contact, or null (too few samples, or the query failed — not cached then). */
export async function programmeResponseAverage(): Promise<number | null> {
  try {
    return await cached();
  } catch (e) {
    console.error("[partner] response average unavailable", e instanceof Error ? e.message : "unknown");
    return null;
  }
}
