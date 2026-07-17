import InsightsIndex, { insightsPageMetadata } from "./InsightsIndex";

/* Cyprus Insights — page 1 (featured + 15). Page 2+ live at /preview-insights/page/N. */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return insightsPageMetadata(1);
}

export default function InsightsIndexPage() {
  return <InsightsIndex page={1} />;
}
