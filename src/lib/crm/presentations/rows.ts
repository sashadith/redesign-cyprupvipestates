// Presentation list rows for a lead: loads a lead's client presentations and
// turns them into the plain rows both the old admin CRM and the new CRM render.
import { prisma } from "@/lib/prisma";

const include = {
  views: { select: { developmentId: true, durationSec: true, createdAt: true } },
  items: {
    orderBy: { sortIndex: "asc" as const },
    select: {
      developmentId: true,
      aliasName: true,
      isFavorited: true,
      development: { select: { publicName: true, developerAccountId: true, override: { select: { alias: true } } } },
    },
  },
  advisor: { select: { name: true } },
  partner: { select: { firstName: true, lastName: true } },
};

export type RawPresentation = Awaited<ReturnType<typeof loadLeadPresentations>>[number];

export type PresentationListRow = {
  id: string;
  token: string;
  status: string;
  effectiveStatus: "active" | "expired" | "revoked";
  createdAt: Date;
  expiresAt: Date | null;
  advisorName: string | null;
  partnerName: string | null;
  viewCount: number;
  uniqueDays: number;
  favoritedCount: number;
  lastViewedAt: Date | null;
  items: { developmentId: string; developerAccountId: string | null; name: string; isFavorited: boolean; views: number; durationSec: number }[];
};

/** A lead's presentations, newest first. */
export async function loadLeadPresentations(leadId: string) {
  return prisma.clientPresentation.findMany({ where: { leadId }, orderBy: { createdAt: "desc" }, include });
}

export function buildPresentationRows(raw: RawPresentation[], now: Date): PresentationListRow[] {
  return raw.map((p) => {
    const perDev = new Map<string, { views: number; durationSec: number }>();
    for (const v of p.views) {
      if (!v.developmentId) continue;
      const cur = perDev.get(v.developmentId) ?? { views: 0, durationSec: 0 };
      cur.views += 1;
      cur.durationSec += v.durationSec ?? 0;
      perDev.set(v.developmentId, cur);
    }
    const effectiveStatus: PresentationListRow["effectiveStatus"] =
      p.status === "revoked" ? "revoked" : p.status === "expired" || (p.expiresAt && p.expiresAt.getTime() <= now.getTime()) ? "expired" : "active";
    const lastViewedAt = p.views.length ? new Date(Math.max(...p.views.map((v) => v.createdAt.getTime()))) : null;
    return {
      id: p.id,
      token: p.token,
      status: p.status,
      effectiveStatus,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      advisorName: p.advisor?.name ?? null,
      partnerName: p.partner ? `${p.partner.firstName} ${p.partner.lastName}`.trim() : null,
      viewCount: p.views.length,
      uniqueDays: new Set(p.views.map((v) => v.createdAt.toISOString().slice(0, 10))).size,
      favoritedCount: p.items.filter((i) => i.isFavorited).length,
      lastViewedAt,
      items: p.items.map((i) => ({
        developmentId: i.developmentId,
        developerAccountId: i.development.developerAccountId ?? null,
        name: i.aliasName || i.development.override?.alias || i.development.publicName,
        isFavorited: i.isFavorited,
        views: perDev.get(i.developmentId)?.views ?? 0,
        durationSec: perDev.get(i.developmentId)?.durationSec ?? 0,
      })),
    };
  });
}
