// Retired at the SEO-activation cutover (2026-07-17): the real Development
// page now lives at /[lang]/projects/[slug] (merged with the legacy Project
// route there — see that file's dispatch-order comment). This stub only keeps
// every already-indexed/shared /preview-project/[slug] URL alive via a
// permanent redirect, so existing search results, client-presentation links,
// and anything bookmarked before the cutover keep working.
import { permanentRedirect } from "next/navigation";
import { localizedHref } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default function LegacyPreviewProjectSlugRedirect({ params }: { params: { lang: string; slug: string } }) {
  permanentRedirect(localizedHref(params.lang, ["projects", params.slug]));
}
