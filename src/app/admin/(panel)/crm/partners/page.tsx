import LeadsListView from "../LeadsListView";
import type { LeadSearchParams } from "../filters";

export const dynamic = "force-dynamic";

// Partner leads (source PARTNER) on a page of their own, with the full leads
// toolset. Only the LIST moved here (operator, 2026-10-08): the pipeline board
// and the Action Center's follow-up rules still include partners.
export default function CrmPartners({ searchParams }: { searchParams: LeadSearchParams }) {
  return <LeadsListView searchParams={searchParams} bucket="partner" />;
}
