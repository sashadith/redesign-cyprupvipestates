import { getLegacyProjectRedirect } from "@/sanity/sanity.utils";
import { resolveDevelopmentSlugHistory } from "@/lib/developmentRender";
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
