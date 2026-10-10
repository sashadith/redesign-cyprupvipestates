// What deleting a DeveloperAccount takes with it (2026-10-09/10).
//
// The delete is one row, but Development → DeveloperAccount is ON DELETE
// CASCADE, and from there units, overrides, slug history and client
// presentation items cascade too (see the *_developmentId_fkey constraints in
// prisma/migrations). Published project pages then 404, client presentations
// already sent lose those projects, and legacy URLs redirected onto them end
// in a 404. The admin dialog shows exactly this before asking for the typed
// name; the server action re-checks the name (deleteConfirmationMatches).
//
// Pure DB reads with the client passed in, so node:test can drive it.

export type AccountDeleteImpact = {
  name: string;
  developments: number;
  units: number;
  published: { name: string; slug: string | null }[];
  presentationItems: number;
  redirectsIn: number;
};

export async function developerAccountDeleteImpact(db: any, id: string): Promise<AccountDeleteImpact> {
  const acct = await db.developerAccount.findUnique({ where: { id }, select: { name: true } });
  if (!acct) throw new Error("Developer account not found");
  const devs: { id: string; slug: string | null; publicName: string; publishStatus: string; override?: { alias: string | null } | null }[] =
    await db.development.findMany({
      where: { developerAccountId: id },
      select: { id: true, slug: true, publicName: true, publishStatus: true, override: { select: { alias: true } } },
    });
  const ids = devs.map((d) => d.id);
  const slugs = devs.map((d) => d.slug).filter((s): s is string => !!s);
  const [units, presentationItems, redirects] = await Promise.all([
    ids.length ? db.developmentUnit.count({ where: { developmentId: { in: ids } } }) : 0,
    ids.length ? db.clientPresentationItem.count({ where: { developmentId: { in: ids } } }) : 0,
    slugs.length ? db.legacyProjectRedirect.findMany({ select: { targetPath: true } }) : [],
  ]);
  const slugSet = new Set(slugs);
  // targetPath is "/projects/<slug>" or "/<lang>/projects/<slug>"
  const redirectsIn = (redirects as { targetPath: string }[]).filter((r) => {
    const m = r.targetPath.match(/\/projects\/([^/?#]+)\/?$/);
    return !!m && slugSet.has(m[1]);
  }).length;
  return {
    name: acct.name,
    developments: devs.length,
    units,
    published: devs
      .filter((d) => d.publishStatus === "published")
      .map((d) => ({ name: d.override?.alias || d.publicName, slug: d.slug }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    presentationItems,
    redirectsIn,
  };
}
