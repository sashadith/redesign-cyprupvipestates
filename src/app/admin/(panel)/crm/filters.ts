// Shared lead list filtering/sorting — used by the CRM list page and the CSV export
// route so both honour exactly the same query parameters.
import type { Prisma } from "@prisma/client";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "CLOSED", "LOST"];
export const LEAD_SOURCES = ["CONTACT_FORM", "PROJECT_ENQUIRY", "BLOG_ENQUIRY", "WHATSAPP", "PHONE", "REFERRAL", "MANUAL", "PARTNER", "ROI_CALCULATOR", "NEWSLETTER", "OTHER"];
// The Leads page's own dropdown. NEWSLETTER is missing on purpose: those leads
// live on their own page now, so filtering the leads list by it could only ever
// return an empty list.
export const LEAD_LIST_SOURCES = LEAD_SOURCES.filter((s) => s !== "NEWSLETTER");
export const LEAD_LOCALES = ["en", "de", "pl", "ru"];

export type LeadSearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").trim();

export function buildLeadWhere(sp: LeadSearchParams): Prisma.LeadWhereInput {
  // The exclusion goes in AND, never as a top-level `source` key: the URL's own
  // source filter is assigned to where.source further down, and would silently
  // overwrite it. The exclusion would then evaporate for exactly the query that
  // went looking for newsletter leads.
  const where: Prisma.LeadWhereInput = { deletedAt: null, AND: [EXCLUDE_NEWSLETTER] };
  const q = one(sp.q);
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  const status = one(sp.status);
  if (LEAD_STATUSES.includes(status)) where.status = status as any;
  const source = one(sp.source);
  if (LEAD_SOURCES.includes(source)) where.source = source as any;
  const lang = one(sp.lang);
  if (LEAD_LOCALES.includes(lang)) where.languagePreference = lang as any;
  const assignee = one(sp.assignee);
  if (assignee === "unassigned") where.assignedToId = null;
  else if (assignee) where.assignedToId = assignee;
  // Deep-link from the Action Center's "back in stock" notification (Bündel 2)
  // — matches the same way resolveIdentifiedProject() extracts a project from
  // a lead's pageSource URL, but as a direct substring filter against a known
  // Development slug rather than re-running its full resolution chain
  // (which also falls back through a legacy, since-superseded Project model —
  // deliberately not chased here, see developers.ts's backInStockReminders()).
  const project = one(sp.project);
  if (project) where.pageSource = { contains: `/projects/${project}` };
  return where;
}

export function orderForSort(sp: LeadSearchParams): Prisma.LeadOrderByWithRelationInput {
  switch (one(sp.sort)) {
    case "oldest": return { createdAt: "asc" };
    case "updated": return { updatedAt: "desc" };
    case "name": return { firstName: "asc" };
    default: return { createdAt: "desc" };
  }
}

// Re-encode the active filters into a query string (used for pagination + export links).
export function leadQueryString(sp: LeadSearchParams, overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const k of ["q", "status", "source", "lang", "assignee", "project", "sort", "page"]) {
    const v = one(sp[k]);
    if (v) params.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v) params.set(k, v); else params.delete(k);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
