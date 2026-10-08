import LeadsListView from "./LeadsListView";
import type { LeadSearchParams } from "./filters";

export const dynamic = "force-dynamic";

// Leads = every lead that is neither a newsletter subscriber nor a partner
// (those two have their own pages: /admin/crm/newsletter, /admin/crm/partners).
export default function CrmList({ searchParams }: { searchParams: LeadSearchParams }) {
  return <LeadsListView searchParams={searchParams} bucket="leads" />;
}
