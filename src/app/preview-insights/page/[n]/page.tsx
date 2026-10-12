import { permanentRedirect } from "next/navigation";
import InsightsIndex, { insightsPageMetadata } from "../../InsightsIndex";

/* Cyprus Insights — paginated pages 2+ at /preview-insights/page/N.
   Page 1 lives at /preview-insights, so /page/1 (and non-numeric) → permanent redirect
   there, which also avoids duplicate content. */
export const dynamic = "force-dynamic";

const parse = (n: string) => {
  const v = Number(n);
  return Number.isInteger(v) && v >= 2 ? v : null;
};

export function generateMetadata({ params }: { params: { n: string } }) {
  const page = parse(params.n);
  return insightsPageMetadata(page ?? 2);
}

export default function InsightsPagedPage({ params }: { params: { n: string } }) {
  const page = parse(params.n);
  if (page === null) permanentRedirect("/preview-insights");
  return <InsightsIndex page={page} />;
}
