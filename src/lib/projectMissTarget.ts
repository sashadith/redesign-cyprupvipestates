import { getLegacyProjectRedirect } from "@/sanity/sanity.utils";
import { getDbProjectBySlug, resolveDevelopmentSlugHistory } from "@/lib/developmentRender";
import { localizedHref } from "@/lib/locale";
import { missingTarget } from "@/lib/missingPageRedirect";

/**
 * Where /<lang>/projects/<slug> goes when no project page lives there, in one hop: a legacy
 * project merged into a Development, a Development renamed by an admin, otherwise the best live
 * page (the projects index). Shared by the project page and the retired /preview-project stub so
 * the stub lands on the final address instead of bouncing through /projects/<slug> first.
 */
export async function projectMissTarget(lang: string, slug: string): Promise<string | null> {
  const legacy = await getLegacyProjectRedirect(lang, slug);
  if (legacy) return legacy;
  const renamed = await resolveDevelopmentSlugHistory(slug, lang);
  if (renamed) return renamed;
  return missingTarget("project", lang, [slug]);
}

/**
 * For URLs that used to serve something project-shaped but no longer do (the project PDFs under
 * /api/projects/<lang>/<slug>/pdf): the project's live page when it has one, otherwise wherever
 * /projects/<slug> would end up. One hop either way.
 */
export async function projectLandingTarget(lang: string, slug: string): Promise<string | null> {
  const dev = await getDbProjectBySlug(slug, lang);
  if (dev && dev.publishStatus === "published") return localizedHref(lang, ["projects", slug]);
  return projectMissTarget(lang, slug);
}
