import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads, canEditLead, canViewLead, seesAllLeads } from "@/lib/crm/access";
import type { CommissionStatusValue } from "@/lib/crm/commission";
import { toTimeline } from "@/lib/crm/timeline";
import { CockpitContact, CockpitHeader, type CockpitLead } from "../../components/CockpitHeader";
import { CockpitStage } from "../../components/CockpitStage";
import { CockpitDeals } from "../../components/CockpitDeals";
import { CockpitLogForm } from "../../components/CockpitLogForm";
import { CockpitTimeline } from "../../components/CockpitTimeline";
import { CockpitAssign } from "../../components/CockpitAssign";
import { ToastProvider } from "../../components/Toast";
import type { DealRow } from "../../components/DealsTable";

export const dynamic = "force-dynamic";

const TIMELINE_CAP = 100;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Lead cockpit (CRM v2, 2026-10-18). A lead that does not exist and one the
// user may not see look the same: 404.
export default async function LeadCockpitPage({ params }: { params: { id: string } }) {
  const user = await requireCrmUser();
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, nationality: true, countryOfResidence: true,
      languagePreference: true, budgetMin: true, budgetMax: true, timeline: true, financing: true, propertyTypeInterest: true,
      message: true, notes: true, status: true, lostReason: true, source: true, createdAt: true, assignedToId: true,
      assignedTo: { select: { name: true } },
      projectInterest: { select: { title: true, city: true } },
      attributionRef: true, utmSource: true, utmMedium: true, utmCampaign: true,
      deals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, unitLabel: true, price: true, ourRatePercent: true, rateSource: true, ourCommission: true, partnerCommission: true,
          commissionStatus: true, expectedAt: true, earnedAt: true, developerPaidAt: true, paidOutAt: true,
          development: { select: { publicName: true } },
        },
      },
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: TIMELINE_CAP + 1,
        select: { id: true, type: true, direction: true, channel: true, subject: true, body: true, occurredAt: true, createdByName: true, metadata: true },
      },
    },
  });
  if (!lead || !canViewLead(user, lead)) notFound();

  const canEdit = canEditLead(user, lead);
  const canAssign = canAssignLeads(user);
  const staff = canAssign
    ? await prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, acceptsLeads: true } })
    : [];

  const now = new Date();
  const name = `${lead.firstName} ${lead.lastName}`.trim() || "Unnamed lead";
  const attributionRows: [string, string | null][] = [
    ["Partner ref", lead.attributionRef], ["UTM source", lead.utmSource], ["UTM medium", lead.utmMedium], ["UTM campaign", lead.utmCampaign],
  ];
  const attribution = attributionRows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  const view: CockpitLead = {
    id: lead.id, name, email: lead.email, phone: lead.phone, nationality: lead.nationality, countryOfResidence: lead.countryOfResidence,
    lang: lead.languagePreference?.toUpperCase() ?? null, budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
    timeline: lead.timeline, financing: lead.financing, propertyTypes: lead.propertyTypeInterest, message: lead.message, notes: lead.notes,
    status: lead.status, lostReason: lead.lostReason, source: lead.source, ownerName: lead.assignedTo?.name ?? null,
    project: lead.projectInterest ? [lead.projectInterest.title, lead.projectInterest.city].filter(Boolean).join(" · ") : null,
    createdAt: lead.createdAt, attribution,
  };
  const deals: DealRow[] = lead.deals.map((d) => ({
    id: d.id, leadId: lead.id, leadName: name, project: d.development?.publicName ?? null, unitLabel: d.unitLabel, price: d.price,
    ourRatePercent: d.ourRatePercent?.toNumber() ?? null, rateSource: d.rateSource, ourCommission: d.ourCommission, partnerCommission: d.partnerCommission,
    status: d.commissionStatus as CommissionStatusValue,
    expectedAt: day(d.expectedAt), earnedAt: day(d.earnedAt), developerPaidAt: day(d.developerPaidAt), paidOutAt: day(d.paidOutAt),
  }));
  const timeline = toTimeline(lead.interactions.slice(0, TIMELINE_CAP));

  return (
    <ToastProvider>
      <div className="crm-cockpit">
        <CockpitHeader lead={view} now={now} />
        <div className="crm-ck-grid">
          <div className="crm-ck-main">
            <CockpitStage leadId={lead.id} leadName={name} status={lead.status} canEdit={canEdit} />
            <CockpitLogForm leadId={lead.id} canEdit={canEdit} />
            <CockpitTimeline items={timeline} now={now} truncated={lead.interactions.length > TIMELINE_CAP} />
          </div>
          <aside className="crm-ck-aside">
            <CockpitContact lead={view} />
            <CockpitDeals deals={deals} canPayout={canAssign} today={now.toISOString().slice(0, 10)} />
            {canAssign && <CockpitAssign leadId={lead.id} ownerId={lead.assignedToId} staff={staff} />}
            {seesAllLeads(user) && <Link className="crm-ck-old" href={`/admin/crm/${lead.id}`}>Presentations, matching, email →</Link>}
          </aside>
        </div>
      </div>
    </ToastProvider>
  );
}
