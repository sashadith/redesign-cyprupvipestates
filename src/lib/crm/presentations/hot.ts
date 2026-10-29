// "Hot selections": client selections that just got a signal (opened, long look
// at a project, a heart) nobody has followed up yet, plus quiet-but-engaged ones
// that are about to expire. Pure ranking in hotSelections, DB read in loadHotSelections.
import { prisma } from "@/lib/prisma";
import type { SessionCrmUser } from "@/lib/crm/session";
import { SLA_OUTBOUND_TYPES } from "@/lib/crm/sla";

export const HOT_WINDOW_MS = 48 * 3_600_000;
export const HOT_MIN_PROJECT_SEC = 60;
export const EXPIRING_WITHIN_MS = 3 * 86_400_000;
const RECENT_VIEW_MS = 7 * 86_400_000;

export type HotInput = {
  presentationId: string;
  leadId: string;
  leadName: string;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  expiresAt: Date | null;
  views: { developmentId: string | null; durationSec: number | null; createdAt: Date }[];
  favorites: { name: string; favoritedAt: Date | null }[];
  lastOutboundAt: Date | null;
  /** developmentId -> project name, for the "N min on X" reason. */
  projectNames?: Record<string, string>;
};

export type HotRow = {
  presentationId: string;
  leadId: string;
  leadName: string;
  ownerName: string | null;
  kind: "hot" | "expiring";
  signalAt: Date;
  reasons: string[];
  expiresAt: Date | null;
};

const newest = (ds: Date[]) => new Date(Math.max(...ds.map((d) => d.getTime())));
const opened = (n: number) => (n > 1 ? `opened ${n}×` : "opened");

export function hotSelections(inputs: HotInput[], now: Date): HotRow[] {
  const t = now.getTime();
  const rows: HotRow[] = [];
  for (const p of inputs) {
    if (p.status !== "active" || (p.expiresAt && p.expiresAt.getTime() <= t)) continue;
    const base = { presentationId: p.presentationId, leadId: p.leadId, leadName: p.leadName, ownerName: p.ownerName, expiresAt: p.expiresAt };

    const views = p.views.filter((v) => t - v.createdAt.getTime() <= HOT_WINDOW_MS);
    const favs = p.favorites.filter((f): f is { name: string; favoritedAt: Date } => !!f.favoritedAt && t - f.favoritedAt.getTime() <= HOT_WINDOW_MS);
    const signals = [...views.map((v) => v.createdAt), ...favs.map((f) => f.favoritedAt)];
    if (signals.length > 0) {
      const signalAt = newest(signals);
      // Anything we did after the signal means it is already being handled.
      if (!p.lastOutboundAt || p.lastOutboundAt.getTime() < signalAt.getTime()) {
        const reasons: string[] = [];
        const pageViews = views.filter((v) => !v.developmentId).length;
        if (views.length > 0) reasons.push(opened(Math.max(pageViews, 1)));
        const perProject = new Map<string, { sec: number; long: boolean }>();
        for (const v of views) {
          if (!v.developmentId) continue;
          const cur = perProject.get(v.developmentId) ?? { sec: 0, long: false };
          cur.sec += v.durationSec ?? 0;
          cur.long = cur.long || (v.durationSec ?? 0) >= HOT_MIN_PROJECT_SEC;
          perProject.set(v.developmentId, cur);
        }
        perProject.forEach((cur, devId) => {
          if (cur.long) reasons.push(`${Math.max(1, Math.round(cur.sec / 60))} min on ${p.projectNames?.[devId] ?? "a project"}`);
        });
        for (const f of favs) reasons.push(`♥ ${f.name}`);
        rows.push({ ...base, kind: "hot", signalAt, reasons });
        continue;
      }
    }

    if (p.expiresAt && p.expiresAt.getTime() - t <= EXPIRING_WITHIN_MS) {
      const recent = p.views.filter((v) => t - v.createdAt.getTime() <= RECENT_VIEW_MS);
      if (recent.length > 0) {
        const days = Math.ceil((p.expiresAt.getTime() - t) / 86_400_000);
        const pageViews = recent.filter((v) => !v.developmentId).length;
        rows.push({ ...base, kind: "expiring", signalAt: newest(recent.map((v) => v.createdAt)), reasons: [`expires in ${days} d`, opened(Math.max(pageViews, 1))] });
      }
    }
  }
  return rows.sort((a, b) => b.signalAt.getTime() - a.signalAt.getTime());
}

/** Live selections of the user's leads (the owner sees every lead, staff their own), ranked. */
export async function loadHotSelections(user: SessionCrmUser, now: Date): Promise<HotRow[]> {
  const since = new Date(now.getTime() - RECENT_VIEW_MS);
  const rows = await prisma.clientPresentation.findMany({
    where: {
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      lead: { deletedAt: null, status: { notIn: ["CLOSED", "LOST"] }, ...(user.isOwner ? {} : { assignedToId: user.id }) },
    },
    include: {
      views: { where: { createdAt: { gte: since } }, select: { developmentId: true, durationSec: true, createdAt: true } },
      items: { select: { developmentId: true, aliasName: true, isFavorited: true, favoritedAt: true, development: { select: { publicName: true, override: { select: { alias: true } } } } } },
      lead: {
        select: {
          firstName: true, lastName: true, assignedToId: true, assignedTo: { select: { name: true } },
          interactions: { where: { type: { in: [...SLA_OUTBOUND_TYPES] } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
        },
      },
    },
  });
  const inputs: HotInput[] = rows.map((p) => {
    const name = (i: (typeof p.items)[number]) => i.aliasName || i.development.override?.alias || i.development.publicName;
    return {
      presentationId: p.id,
      leadId: p.leadId,
      leadName: `${p.lead.firstName ?? ""} ${p.lead.lastName ?? ""}`.trim() || "Unnamed lead",
      ownerId: p.lead.assignedToId,
      ownerName: p.lead.assignedTo?.name ?? null,
      status: p.status,
      expiresAt: p.expiresAt,
      views: p.views,
      favorites: p.items.filter((i) => i.isFavorited).map((i) => ({ name: name(i), favoritedAt: i.favoritedAt })),
      lastOutboundAt: p.lead.interactions[0]?.occurredAt ?? null,
      projectNames: Object.fromEntries(p.items.map((i) => [i.developmentId, name(i)])),
    };
  });
  return hotSelections(inputs, now);
}
