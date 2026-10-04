// Resolves what a lead's incoming `projectSlug` should set on the Lead
// record's project-interest fields (Hebrew Localization Phase 7, Task 1).
//
// Every non-`he` locale keeps today's behaviour byte-identical: a legacy
// `Project` row for (slug, language). `he` never has a legacy `Project`
// row — decision H (Phase 5): Hebrew content is seeded as
// Development/CaseStudy/Singlepage only, never the legacy Sanity-origin
// `Project` model — so that lookup always misses for `he`. On a miss we
// resolve the `Development` by its slug (Latin, locale-agnostic — the same
// slug that /[lang]/projects/[slug]/page.tsx resolves via
// getDbProjectBySlug) and, since `Lead` only has `projectInterestId`
// (a `Project` relation, no `Development` relation), fall back to the EN
// legacy `Project` sibling of that Development via
// `supersededByDevelopmentId` — exactly the fallback `mapProjectRowsToLang`
// (src/sanity/sanity.utils.ts, Phase 5) uses for `he`'s "related projects"
// cards.
import { LOCALES, type Locale } from "@/lib/locale";

export type ProjectInterestResult = {
  projectInterestId: string | null;
  developmentId: string | null;
  source: "PROJECT_ENQUIRY" | null;
};

const NONE: ProjectInterestResult = { projectInterestId: null, developmentId: null, source: null };

// Minimal shape this module needs from a Prisma client (or a test fake) —
// kept narrow (args: any, same convention as heTranslateQueue.ts's QueuePrisma)
// so both a test fake and the real generated PrismaClient satisfy it, and
// tests never have to satisfy the full PrismaClient surface.
type Fn = (args: any) => Promise<{ id: string } | null>;
export type ProjectInterestPrisma = {
  project: { findFirst: Fn };
  development: { findUnique: Fn };
};

export async function resolveProjectInterest(opts: {
  projectSlug: string;
  lang: string;
  prisma: ProjectInterestPrisma;
}): Promise<ProjectInterestResult> {
  const slug = opts.projectSlug.trim();
  if (!slug) return NONE;
  const lang: Locale | null = (LOCALES as readonly string[]).includes(opts.lang) ? (opts.lang as Locale) : null;
  if (!lang) return NONE;

  // Today's behaviour, unchanged for en/de/pl/ru — tried first for `he` too
  // (in case a legacy `he` Project row is ever added later), so this is the
  // one and only `Project` lookup with `language: "he"`.
  const legacy = await opts.prisma.project.findFirst({ where: { slug, language: lang }, select: { id: true } });
  if (legacy) return { projectInterestId: legacy.id, developmentId: null, source: "PROJECT_ENQUIRY" };

  const development = await opts.prisma.development.findUnique({ where: { slug }, select: { id: true } });
  if (!development) return NONE;

  // Development found but no storable interest yet (no EN Project sibling
  // recorded) — surface the developmentId for callers that can use it, but
  // never claim PROJECT_ENQUIRY without something to actually point at.
  const enSibling = await opts.prisma.project.findFirst({
    where: { supersededByDevelopmentId: development.id, language: "en" },
    select: { id: true },
  });
  if (!enSibling) return { projectInterestId: null, developmentId: development.id, source: null };

  return { projectInterestId: enSibling.id, developmentId: development.id, source: "PROJECT_ENQUIRY" };
}
