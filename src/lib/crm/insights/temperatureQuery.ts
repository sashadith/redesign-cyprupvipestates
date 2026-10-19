import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import type { TemperatureResult } from "./temperature";
import { TEMPERATURE_ID_CHUNK, chunk, leadsNeedingTemperature, scoreLead, type TemperatureLead, type TemperatureSignals } from "./temperatureWiring";

const INBOUND_TYPES = ["EMAIL_IN", "WHATSAPP_IN"] as const;

async function signalsFor(ids: string[]): Promise<Map<string, TemperatureSignals>> {
  const signals = new Map<string, TemperatureSignals>();
  const slot = (id: string) => {
    let s = signals.get(id);
    if (!s) signals.set(id, (s = {}));
    return s;
  };
  const [inbound, contact, engagement] = await Promise.all([
    prisma.leadInteraction.groupBy({ by: ["leadId"], where: { leadId: { in: ids }, type: { in: [...INBOUND_TYPES] } }, _max: { occurredAt: true } }),
    prisma.leadInteraction.groupBy({ by: ["leadId"], where: { leadId: { in: ids }, type: { in: CONTACT_TYPES } }, _max: { occurredAt: true } }),
    // Page-level views (developmentId null) and favourites, both reached through ClientPresentation.
    prisma.$queryRaw<{ leadId: string; kind: string; at: Date | null }[]>(Prisma.sql`
      SELECT p."leadId" AS "leadId", 'view' AS kind, MAX(v."createdAt") AS at
        FROM presentation_views v JOIN client_presentations p ON p.id = v."presentationId"
       WHERE p."leadId" IN (${Prisma.join(ids)}) AND v."developmentId" IS NULL
       GROUP BY p."leadId"
      UNION ALL
      SELECT p."leadId" AS "leadId", 'fav' AS kind, MAX(i."favoritedAt") AS at
        FROM client_presentation_items i JOIN client_presentations p ON p.id = i."presentationId"
       WHERE p."leadId" IN (${Prisma.join(ids)}) AND i."isFavorited" = true AND i."favoritedAt" IS NOT NULL
       GROUP BY p."leadId"`),
  ]);
  for (const r of inbound) slot(r.leadId).lastInboundAt = r._max.occurredAt;
  for (const r of contact) slot(r.leadId).lastRealContactAt = r._max.occurredAt;
  for (const r of engagement) {
    if (r.kind === "view") slot(r.leadId).lastPresentationViewAt = r.at;
    else slot(r.leadId).lastFavoriteAt = r.at;
  }
  return signals;
}

/**
 * Temperature for the given leads: three batched queries per chunk of ids, then the pure scorer.
 * Leads without a temperature (CLOSED / LOST / KEEP_CONTACT) are skipped before querying and are
 * absent from the map. Temperature is decoration: a query error is logged and yields an empty map.
 */
export async function temperaturesFor(leads: TemperatureLead[], now: Date): Promise<Map<string, TemperatureResult>> {
  const out = new Map<string, TemperatureResult>();
  const eligible = leadsNeedingTemperature(leads);
  if (eligible.length === 0) return out;
  try {
    for (const part of chunk(eligible, TEMPERATURE_ID_CHUNK)) {
      const signals = await signalsFor(part.map((l) => l.id));
      for (const lead of part) {
        const t = scoreLead(lead, signals.get(lead.id) ?? {}, now);
        if (t) out.set(lead.id, t);
      }
    }
    return out;
  } catch (e) {
    console.error("[crm] temperaturesFor failed", e);
    return new Map();
  }
}
