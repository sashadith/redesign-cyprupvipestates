// Guide article URL in one language (see ../../blog/guideRoute.tsx): ratgeber.
//
// Rendered per request, not through ISR: with ISR a guide that is published after the build is generated on its
// first request, and in production that on-demand render failed (DYNAMIC_SERVER_USAGE, a 500) because
// getBlogPostByLang asks Next whether Draft Mode is on (src/sanity/sanity.utils.ts, draftFilter). Same setting as the
// project pages, which are dynamic for the same reason. The sitemap and the guides index list the pages either way.
import { GuidePage, guideMetadata } from "../../blog/guideRoute";

export const dynamic = "force-dynamic";
export async function generateMetadata(props: { params: { lang: string; slug: string } }) {
  return guideMetadata(props, "ratgeber");
}
export default async function Page(props: { params: { lang: string; slug: string } }) {
  return GuidePage(props, "ratgeber");
}
