// Shared lead list filtering/sorting — used by the CRM list page and the CSV export
// route so both honour exactly the same query parameters.
import type { Prisma } from "@prisma/client";

export const LEAD_STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
export const LEAD_SOURCES = ["CONTACT_FORM", "PROJECT_ENQUIRY", "BLOG_ENQUIRY", "WHATSAPP", "PHONE", "REFERRAL", "MANUAL", "PARTNER", "ROI_CALCULATOR", "NEWSLETTER", "OTHER"];
export const LEAD_LOCALES = ["en", "de", "pl", "ru"];
export const LEAD_PAGE_SIZE = 50;

export type LeadSearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").trim();

export function buildLeadWhere(sp: LeadSearchParams): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
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
  for (const k of ["q", "status", "source", "lang", "assignee", "sort", "page"]) {
    const v = one(sp[k]);
    if (v) params.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v) params.set(k, v); else params.delete(k);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
