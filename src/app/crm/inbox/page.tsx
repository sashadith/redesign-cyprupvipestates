import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { ACTIVE_LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { suggestOwner, type Candidate } from "@/lib/crm/suggestOwner";
import { InboxList, type InboxItem } from "../components/InboxList";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { PARTNER: "Partner", META_LEAD_AD: "Meta ad", CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Project page", WHATSAPP: "WhatsApp" };

export default async function InboxPage() {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  const [leads, staff, loads] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, assignedToId: null, ...EXCLUDE_NEWSLETTER },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, firstName: true, lastName: true, createdAt: true, source: true, languagePreference: true, budgetMax: true, projectInterest: { select: { id: true, title: true, city: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, acceptsLeads: true, languages: true, specialties: true } }),
    prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, assignedToId: { not: null }, status: { in: [...ACTIVE_LEAD_STATUSES] } }, _count: { _all: true } }),
  ]);

  const loadOf = new Map(loads.map((l) => [l.assignedToId, l._count._all]));
  const candidates: Candidate[] = staff.map((s) => ({ ...s, activeLeads: loadOf.get(s.id) ?? 0 }));
  const items: InboxItem[] = leads.map((l) => {
    const keys = [l.projectInterest?.id, l.projectInterest?.city].filter((x): x is string => !!x);
    const s = suggestOwner({ language: l.languagePreference, specialtyKeys: keys }, candidates);
    return {
      id: l.id, name: `${l.firstName} ${l.lastName}`.trim(), lang: l.languagePreference?.toUpperCase() ?? null,
      source: SOURCE_LABEL[l.source] ?? l.source, isPartner: l.source === "PARTNER",
      interest: l.projectInterest?.title ?? null, createdAt: l.createdAt.toISOString(),
      suggestion: s ? { userId: s.userId, name: s.name, reason: s.reason } : null,
    };
  });

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Inbox</h1>
          <p>{items.length === 0 ? "Every lead has an owner." : `${items.length} unassigned, oldest first`}</p>
        </div>
      </div>
      <InboxList items={items} staff={staff.map((s) => ({ id: s.id, name: s.name, acceptsLeads: s.acceptsLeads }))} />
    </>
  );
}
