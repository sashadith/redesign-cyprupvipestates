// Partner scope (partner portal phase 3b): the only place portal pages read CRM-side data.
// Every function takes the session's partnerId (from requirePartner({ active: true })) and
// returns DTOs — never raw Prisma rows, never data of other partners.
import { prisma } from "@/lib/prisma";
import { resolveRate, type RateRow } from "@/lib/crm/commission";

export type MyProject = {
  id: string;
  name: string;
  town: string | null;
  slug: string | null;
  /** Partner's effective rate in % of the price (our rate × share / 100, 2 decimals); null = rate on request. */
  handoverRate: number | null;
  fixRate: number | null;
  /** Our rate — only for trust-mode partners, null otherwise or when missing. */
  ourRate: number | null;
};

export type MyProjects = { handoverShare: number; fixShare: number; trustMode: boolean; projects: MyProject[] };

/** our rate % × partner share % / 100, rounded to 2 decimals in integer basis points (5.55 × 33.33 → 1.85). */
export function effectiveRate(ourRatePercent: number | null, sharePercent: number): number | null {
  if (ourRatePercent == null) return null;
  return Math.round((Math.round(ourRatePercent * 100) * Math.round(sharePercent * 100)) / 10000) / 100;
}

export type ProjectRow = { id: string; name: string; town: string | null; slug: string | null; developerAccountId: string };

/** Pure: projects + all rate rows of their developer accounts → DTOs sorted by name. */
export function projectRates(
  devs: ProjectRow[],
  rates: RateRow[],
  p: { handoverShare: number; fixShare: number; trustMode: boolean },
): MyProject[] {
  return devs
    .map((d) => {
      const our = resolveRate(rates, d.developerAccountId, d.id).ratePercent;
      return {
        id: d.id,
        name: d.name,
        town: d.town,
        slug: d.slug,
        handoverRate: effectiveRate(our, p.handoverShare),
        fixRate: effectiveRate(our, p.fixShare),
        ourRate: p.trustMode ? our : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id));
}

/** Published developments with the partner's rates. Three queries in total, no N+1. */
export async function myProjects(partnerId: string): Promise<MyProjects> {
  const [partner, devs] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId }, select: { handoverShare: true, fixShare: true, trustMode: true } }),
    prisma.development.findMany({
      where: { publishStatus: "published" },
      select: { id: true, publicName: true, town: true, slug: true, developerAccountId: true, override: { select: { alias: true, town: true } } },
    }),
  ]);
  if (!partner) return { handoverShare: 0, fixShare: 0, trustMode: false, projects: [] };
  const shares = { handoverShare: Number(partner.handoverShare), fixShare: Number(partner.fixShare), trustMode: partner.trustMode };
  const accountIds = Array.from(new Set(devs.map((d) => d.developerAccountId)));
  const rateRows = accountIds.length
    ? await prisma.commissionRate.findMany({
        where: { developerAccountId: { in: accountIds } },
        select: { developerAccountId: true, developmentId: true, ratePercent: true },
      })
    : [];
  const rates: RateRow[] = rateRows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: Number(r.ratePercent) }));
  const rows: ProjectRow[] = devs.map((d) => ({
    id: d.id,
    name: d.override?.alias?.trim() || d.publicName,
    town: d.override?.town?.trim() || d.town || null,
    slug: d.slug,
    developerAccountId: d.developerAccountId,
  }));
  return { ...shares, projects: projectRates(rows, rates, shares) };
}
