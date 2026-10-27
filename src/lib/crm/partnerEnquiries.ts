import { prisma } from "@/lib/prisma";
import { STATUS_LABEL, isLeadStatus } from "./leadStatus";
import { PARTNER_ENQUIRY } from "./leadBucket";

// Website partner enquiries for /crm/partners (2026-10-27). They left the pipeline
// (EXCLUDE_PARTNER_ENQUIRY), so this is where they are seen. Someone who has since
// registered on the partner portal with the same email is already in the partner
// tabs and drops out here; lost and closed enquiries are done.
export type PartnerEnquiryRow = {
  id: string; name: string; email: string | null; phone: string | null; country: string | null;
  received: string; status: string;
};

export const ENQUIRY_CAP = 100;

// The form route writes "Partner / cooperation enquiry · Country: XY" into notes.
export function enquiryCountry(notes: string | null): string | null {
  const m = notes?.match(/Country:\s*([^\n·]+)/);
  return m ? m[1].trim() || null : null;
}

export function dropRegistered<T extends { email: string | null }>(rows: T[], partnerEmails: string[]): T[] {
  const known = new Set(partnerEmails.map((e) => e.trim().toLowerCase()));
  return rows.filter((r) => !r.email || !known.has(r.email.trim().toLowerCase()));
}

export async function loadPartnerEnquiries(): Promise<PartnerEnquiryRow[]> {
  const [leads, users] = await Promise.all([
    prisma.lead.findMany({
      where: { AND: [PARTNER_ENQUIRY, { deletedAt: null, status: { notIn: ["LOST", "CLOSED"] } }] },
      orderBy: { createdAt: "desc" },
      take: ENQUIRY_CAP,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, notes: true, createdAt: true, status: true },
    }),
    prisma.partnerUser.findMany({ select: { email: true } }),
  ]);
  return dropRegistered(leads, users.map((u) => u.email)).map((l) => ({
    id: l.id,
    name: `${l.firstName} ${l.lastName}`.trim() || "(no name)",
    email: l.email, phone: l.phone, country: enquiryCountry(l.notes),
    received: l.createdAt.toISOString().slice(0, 10),
    status: isLeadStatus(l.status) ? STATUS_LABEL[l.status] : l.status,
  }));
}
