import { redirectMissingOrNotFound } from "@/lib/missingPageRedirect";

/* /preview-insights/<slug> was never a page (only the index and /page/N exist), yet
   such URLs were shared and indexed. Send them to the real article, or the blog. */
export const dynamic = "force-dynamic";

export default async function LegacyPreviewInsightsSlug({ params }: { params: { slug: string } }) {
  return redirectMissingOrNotFound("blog", "en", [params.slug], `/preview-insights/${params.slug}`);
}
