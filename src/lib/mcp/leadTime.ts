import { callWindowFromEnv, followUpLeadTime, leadTimeSummary, weekLabel } from "@/lib/crm/leadLocalTime";

// The lead's local time and the next follow-up on the lead's clock, for every MCP tool that lists
// leads (crm_get_lead, crm_search_leads, crm_worklist). Display only (2026-11-04).
export function leadTimeFields(
  l: { timeZone?: string | null; countryOfResidence?: string | null; phone?: string | null; nextFollowUpAt?: Date | null },
  now: Date = new Date(),
) {
  const localTime = leadTimeSummary(l, now, callWindowFromEnv());
  const at = l.nextFollowUpAt ?? null;
  return {
    localTime,
    nextFollowUp: at ? { week: weekLabel(at), leadTime: localTime.zone ? followUpLeadTime(at, localTime.zone) : null } : null,
  };
}
