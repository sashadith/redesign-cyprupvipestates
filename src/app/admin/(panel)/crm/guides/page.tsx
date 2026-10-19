import LeadsListView from "../LeadsListView";
import type { LeadSearchParams } from "../filters";

export const dynamic = "force-dynamic";

// Guide leads (source GUIDE_DOWNLOAD, 2026-10-19): visitors who asked for one of
// the PDF guides, on a page of their own so they don't mix with buyer leads.
// Like partners, only the LIST moved here: the pipeline board and the Action
// Center's follow-up rules still include them.
export default function CrmGuideLeads({ searchParams }: { searchParams: LeadSearchParams }) {
  return <LeadsListView searchParams={searchParams} bucket="guide" />;
}
