// Deactivate / reactivate / delete a PUBLIC developer page (2026-10-09).
//
// A developer page is a translation group: one Developer row per language,
// tied together by translationGroupId (a legacy row without a group stands
// alone). Every operation here acts on the WHOLE group — a page that is live
// in DE but gone in EN would leave hreflang pointing into a redirect.
//
// What hangs off a page, and what each operation does to it:
//  - DeveloperAccount.developerTranslationGroupId — the feed/admin account
//    whose published Developments fill the page's catalog. Deactivating keeps
//    the link (reactivation restores the page as it was); deleting clears it,
//    so developerLinkBrokenReminders() doesn't raise a false "broken link".
//  - Project.developerId (legacy Sanity projects) — ON DELETE SET NULL at the
//    DB, so deleting only drops the "Developer:" line on those pages.
//  - Optionally, on deactivate: archive the account's published Developments
//    and the group's published legacy Projects, taking their pages offline too.
//    Reactivating does NOT republish them — each goes back through the normal
//    publish gate by hand.
//
//  - LegacyProjectRedirect rows whose target IS this page (old project URLs
//    deliberately pointed at a developer page) are re-pointed to the
//    developers index of the same language on deactivate and delete — else
//    they would chain two 308s, or end in a 404 after a delete.
//
// Pure DB logic with the client passed in (no Next or Prisma imports), so the node:test
// suite can drive it against an in-memory fake. The admin server actions
// (src/app/admin/actions.ts) add the session check, cache revalidation and
// IndexNow pings around it.

import { localizedHref } from "@/lib/locale";

export const ACTIVE_DEVELOPER = { deactivatedAt: null } as const;

type Row = { id: string; translationGroupId: string | null; language: string; slug: string; title: string; deactivatedAt: Date | null };

export type DeveloperImpact = {
  title: string;
  translationGroupId: string | null;
  deactivated: boolean;
  rows: { id: string; language: string; slug: string }[];
  account: { id: string; name: string } | null;
  /** The account's published Developments — archived by "archive projects". */
  publishedDevelopments: { id: string; slug: string | null; name: string }[];
  /** The group's published legacy Projects (all languages) — archived by "archive projects". */
  publishedProjects: { id: string; language: string; slug: string }[];
  /** Legacy Projects (any status) whose "Developer:" link points at this page. */
  linkingProjects: number;
  /** Archived-project redirects that land on this page — re-pointed to the index. */
  redirectsIn: { id: string; targetPath: string; to: string }[];
};

/** The rows of a page's group — the row itself when it has no group. */
export function groupWhere(row: { id: string; translationGroupId: string | null }) {
  return row.translationGroupId ? { translationGroupId: row.translationGroupId } : { id: row.id };
}

/** Typed-name confirmation for delete: exact title, ignoring case and outer spaces. */
export function deleteConfirmationMatches(typed: string, title: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(typed) !== "" && norm(typed) === norm(title);
}

async function loadGroup(db: any, id: string): Promise<{ row: Row; rows: Row[] }> {
  const row: Row | null = await db.developer.findUnique({ where: { id } });
  if (!row) throw new Error("Developer not found");
  const rows: Row[] = await db.developer.findMany({ where: groupWhere(row) });
  return { row, rows };
}

/** The title shown in confirmations — the EN row's, else the opened row's. */
function groupTitle(row: Row, rows: Row[]): string {
  return rows.find((r) => r.language === "en")?.title ?? row.title;
}

export async function developerImpact(db: any, id: string): Promise<DeveloperImpact> {
  const { row, rows } = await loadGroup(db, id);
  const ids = rows.map((r) => r.id);
  const account = row.translationGroupId
    ? await db.developerAccount.findFirst({ where: { developerTranslationGroupId: row.translationGroupId }, select: { id: true, name: true } })
    : null;
  // Each language row's own URL, mapped to that language's developers index.
  const repoint = new Map(rows.map((r) => [localizedHref(r.language, ["developers", r.slug]), localizedHref(r.language, ["developers"])]));
  const [publishedDevelopments, publishedProjects, linkingProjects, redirects] = await Promise.all([
    account
      ? db.development.findMany({ where: { developerAccountId: account.id, publishStatus: "published" }, select: { id: true, slug: true, publicName: true } })
      : Promise.resolve([]),
    db.project.findMany({ where: { developerId: { in: ids }, status: "PUBLISHED" }, select: { id: true, language: true, slug: true } }),
    db.project.count({ where: { developerId: { in: ids } } }),
    db.legacyProjectRedirect.findMany({ where: { targetPath: { in: Array.from(repoint.keys()) } }, select: { id: true, targetPath: true } }),
  ]);
  return {
    title: groupTitle(row, rows),
    translationGroupId: row.translationGroupId,
    deactivated: rows.some((r) => r.deactivatedAt != null),
    rows: rows.map((r) => ({ id: r.id, language: r.language, slug: r.slug })),
    account: account ? { id: account.id, name: account.name } : null,
    publishedDevelopments: publishedDevelopments.map((d: any) => ({ id: d.id, slug: d.slug, name: d.publicName })),
    publishedProjects,
    linkingProjects,
    redirectsIn: redirects.map((r: any) => ({ id: r.id, targetPath: r.targetPath, to: repoint.get(r.targetPath)! })),
  };
}

function repointRedirects(db: any, impact: DeveloperImpact) {
  return impact.redirectsIn.map((r) => db.legacyProjectRedirect.updateMany({ where: { id: r.id }, data: { targetPath: r.to } }));
}

export async function deactivateDeveloperGroup(db: any, id: string, opts: { archiveProjects: boolean }, now = new Date()) {
  const impact = await developerImpact(db, id);
  const ids = impact.rows.map((r) => r.id);
  const devIds = opts.archiveProjects ? impact.publishedDevelopments.map((d) => d.id) : [];
  const projIds = opts.archiveProjects ? impact.publishedProjects.map((p) => p.id) : [];
  await db.$transaction([
    db.developer.updateMany({ where: { id: { in: ids } }, data: { deactivatedAt: now } }),
    ...repointRedirects(db, impact),
    // Nothing to translate for an offline page (the HE handler also copies
    // deactivatedAt, so a job that slips through cannot bring it back live).
    db.aiGenerationQueue.deleteMany({ where: { entityId: { in: ids }, status: "PENDING" } }),
    ...(devIds.length ? [db.development.updateMany({ where: { id: { in: devIds } }, data: { publishStatus: "archived", publishedAt: null } })] : []),
    ...(projIds.length ? [db.project.updateMany({ where: { id: { in: projIds } }, data: { status: "ARCHIVED" } })] : []),
  ]);
  return {
    impact,
    archivedDevelopments: opts.archiveProjects ? impact.publishedDevelopments : [],
    archivedProjects: opts.archiveProjects ? impact.publishedProjects : [],
  };
}

export async function reactivateDeveloperGroup(db: any, id: string) {
  const { rows } = await loadGroup(db, id);
  await db.developer.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { deactivatedAt: null } });
  return { rows: rows.map((r) => ({ id: r.id, language: r.language, slug: r.slug })) };
}

export async function deleteDeveloperGroup(db: any, id: string, typedName: string) {
  const impact = await developerImpact(db, id);
  if (!deleteConfirmationMatches(typedName, impact.title)) {
    throw new Error(`Type the developer name "${impact.title}" to confirm.`);
  }
  const ids = impact.rows.map((r) => r.id);
  await db.$transaction([
    ...(impact.translationGroupId
      ? [db.developerAccount.updateMany({ where: { developerTranslationGroupId: impact.translationGroupId }, data: { developerTranslationGroupId: null } })]
      : []),
    ...repointRedirects(db, impact),
    // A pending HE job for a deleted row would only fail later in the queue.
    db.aiGenerationQueue.deleteMany({ where: { entityId: { in: ids }, status: "PENDING" } }),
    db.developer.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return { impact };
}
