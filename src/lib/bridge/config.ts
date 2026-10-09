import { prisma } from "@/lib/prisma";

/** One developer account as the bridge admin screen shows it. */
export type BridgeDeveloper = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  changedAt: Date | null;
  publishedProjects: number;
};

/**
 * Every developer account, with its switch and how much it would deliver.
 *
 * Returns ALL accounts, not just enabled ones: the screen's job is to let
 * someone turn a developer ON, which is impossible if the off ones are hidden.
 * Measured 2026-10-09: 25 accounts, 24 of them with published work.
 */
export async function listBridgeDevelopers(): Promise<BridgeDeveloper[]> {
  const [accounts, counts] = await Promise.all([
    prisma.developerAccount.findMany({
      select: { id: true, name: true, slug: true, bridgeEnabled: true, bridgeChangedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.development.groupBy({
      by: ["developerAccountId"],
      where: { publishStatus: "published" },
      _count: { _all: true },
    }),
  ]);
  const published = new Map(counts.map((c) => [c.developerAccountId, c._count._all]));
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    enabled: a.bridgeEnabled,
    changedAt: a.bridgeChangedAt,
    publishedProjects: published.get(a.id) ?? 0,
  }));
}

/**
 * Flip one developer's switch, stamping WHEN.
 *
 * The stamp is the whole point — see the schema comment. It is written on
 * every call, including a no-op re-enable, because `removedSince` reads it as
 * "the switch was last touched at T", not as "it was turned off at T".
 */
export async function setBridgeEnabled(slug: string, enabled: boolean): Promise<void> {
  await prisma.developerAccount.update({
    where: { slug },
    data: { bridgeEnabled: enabled, bridgeChangedAt: new Date() },
  });
}

/** Ids of the developer accounts currently deliverable. */
export async function enabledDeveloperIds(): Promise<string[]> {
  const rows = await prisma.developerAccount.findMany({
    where: { bridgeEnabled: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
