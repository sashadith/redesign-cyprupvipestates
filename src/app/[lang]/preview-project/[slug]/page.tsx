// Retired at the SEO-activation cutover (2026-07-17): the real Development
// page now lives at /[lang]/projects/[slug] (merged with the legacy Project
// route there — see that file's dispatch-order comment). This stub only keeps
// every already-indexed/shared /preview-project/[slug] URL alive via a
// permanent redirect, so existing search results, client-presentation links,
// and anything bookmarked before the cutover keep working.
//
// One hop: when /projects/<slug> is not a live page either (archived or never
// published), go straight to wherever that URL would end up instead of
// bouncing through it (preview-project -> projects/<slug> -> projects).
import { permanentRedirect } from "next/navigation";
import { localizedHref } from "@/lib/locale";
import { getDbProjectBySlug } from "@/lib/developmentRender";
import { getProjectByLang } from "@/sanity/sanity.utils";
import { projectMissTarget } from "@/lib/projectMissTarget";

export const dynamic = "force-dynamic";

export default async function LegacyPreviewProjectSlugRedirect({ params }: { params: { lang: string; slug: string } }) {
  const { lang, slug } = params;
  const live = localizedHref(lang, ["projects", slug]);
  const dev = await getDbProjectBySlug(slug, lang);
  if (dev && dev.publishStatus === "published") permanentRedirect(live);
  if (await getProjectByLang(lang, slug)) permanentRedirect(live);
  permanentRedirect((await projectMissTarget(lang, slug)) ?? live);
}
