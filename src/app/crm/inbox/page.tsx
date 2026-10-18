import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { inboxWhere } from "@/lib/crm/inboxWhere";
import { ACTIVE_LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { suggestOwner, type Candidate } from "@/lib/crm/suggestOwner";
import { listClaimsForReview } from "@/lib/crm/claimReview";
import { InboxList, type InboxItem } from "../components/InboxList";
import { ClaimReview } from "../components/ClaimReview";

export const dynamic = "force-dynamic";

const INBOX_CAP = 200;

const SOURCE_LABEL: Record<string, string> = { PARTNER: "Partner", META_LEAD_AD: "Meta ad", CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Project page", WHATSAPP: "WhatsApp" };

export default async function InboxPage() {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  const [leads, total, staff, loads, claims] = await Promise.all([
    prisma.lead.findMany({
      where: inboxWhere(),
      orderBy: { createdAt: "asc" },
      take: INBOX_CAP,
      select: { id: true, firstName: true, lastName: true, createdAt: true, source: true, partnerId: true, partnerMode: true, languagePreference: true, budgetMax: true, projectInterest: { select: { id: true, title: true, city: true } } },
    }),
    prisma.lead.count({ where: inboxWhere() }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, acceptsLeads: true, languages: true, specialties: true } }),
    prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, assignedToId: { not: null }, status: { in: [...ACTIVE_LEAD_STATUSES] } }, _count: { _all: true } }),
    listClaimsForReview(),
  ]);

  const loadOf = new Map(loads.map((l) => [l.assignedToId, l._count._all]));
  const candidates: Candidate[] = staff.map((s) => ({ ...s, activeLeads: loadOf.get(s.id) ?? 0 }));
  const items: InboxItem[] = leads.map((l) => {
    const keys = [l.projectInterest?.id, l.projectInterest?.city].filter((x): x is string => !!x);
    // Fix leads skip the sales suggestion: whoever registered the client with the developer takes them (decision 5).
    const isFix = l.partnerMode === "FIX";
    const s = isFix ? null : suggestOwner({ language: l.languagePreference, specialtyKeys: keys }, candidates);
    return {
      id: l.id, name: `${l.firstName} ${l.lastName}`.trim(), lang: l.languagePreference?.toUpperCase() ?? null,
      source: SOURCE_LABEL[l.source] ?? l.source, isPartner: l.source === "PARTNER",
      // A known lead a partner's claim was accepted on keeps its own source; it still gets the badge.
      partnerBadge: l.source !== "PARTNER" && l.partnerId != null, isFix,
      interest: l.projectInterest?.title ?? null, createdAt: l.createdAt.toISOString(),
      suggestion: s ? { userId: s.userId, name: s.name, reason: s.reason } : null,
    };
  });

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Inbox</h1>
          <p>{total === 0 ? "Every lead has an owner." : total > INBOX_CAP ? `${total} unassigned, showing the oldest ${INBOX_CAP}` : `${total} unassigned`}</p>
        </div>
      </div>
      <ClaimReview cards={claims.cards} total={claims.total} />
      <InboxList items={items} staff={staff.map((s) => ({ id: s.id, name: s.name, acceptsLeads: s.acceptsLeads }))} />
    </>
  );
}
