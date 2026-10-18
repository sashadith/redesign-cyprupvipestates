import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads, canEditLead, canViewLead, seesAllLeads } from "@/lib/crm/access";
import type { CommissionStatusValue } from "@/lib/crm/commission";
import { toTimeline } from "@/lib/crm/timeline";
import { REAL_CONTACT_TYPES } from "@/lib/partner/claims";
import { buildCockpitPartnerCard, messagePartnerLabel, type ClaimStateValue } from "@/lib/crm/partnerClaims";
import { CockpitContact, CockpitHeader, type CockpitLead } from "../../components/CockpitHeader";
import { CockpitStage } from "../../components/CockpitStage";
import { CockpitDeals } from "../../components/CockpitDeals";
import { CockpitLogForm } from "../../components/CockpitLogForm";
import { CockpitTimeline } from "../../components/CockpitTimeline";
import { CockpitAssign } from "../../components/CockpitAssign";
import { CockpitSummary } from "../../components/CockpitSummary";
import { CockpitPartner, type CockpitPartnerView } from "../../components/CockpitPartner";
import { ToastProvider } from "../../components/Toast";
import { CreatedToast } from "../../components/CreatedToast";
import type { DealRow } from "../../components/DealsTable";

export const dynamic = "force-dynamic";

const TIMELINE_CAP = 100;
const PARTNER_MESSAGES_CAP = 50;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Lead cockpit (CRM v2, 2026-10-18). A lead that does not exist and one the
// user may not see look the same: 404.
export default async function LeadCockpitPage({ params, searchParams }: { params: { id: string }; searchParams?: { created?: string | string[] } }) {
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
      contactRepName: true, contactRepPhone: true,
      claims: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, state: true, mode: true, contactMode: true, createdAt: true, reviewedAt: true, submission: true,
          partner: { select: { id: true, company: true, firstName: true, lastName: true, status: true, type: true } },
        },
      },
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
  const partnerView = await loadPartnerView(lead, canEdit, canAssign, now);
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
      <CreatedToast show={searchParams?.created === "1"} />
      <div className="crm-cockpit">
        <CockpitHeader lead={view} now={now} />
        <div className="crm-ck-grid">
          <div className="crm-ck-main">
            <CockpitStage leadId={lead.id} leadName={name} status={lead.status} canEdit={canEdit} />
            <CockpitSummary leadId={lead.id} />
            <CockpitLogForm leadId={lead.id} canEdit={canEdit} />
            <CockpitTimeline items={timeline} now={now} truncated={lead.interactions.length > TIMELINE_CAP} />
          </div>
          <aside className="crm-ck-aside">
            <CockpitContact lead={view} />
            {partnerView && <CockpitPartner view={partnerView} />}
            <CockpitDeals deals={deals} canPayout={canAssign} today={now.toISOString().slice(0, 10)} />
            {canAssign && <CockpitAssign leadId={lead.id} ownerId={lead.assignedToId} staff={staff} />}
            {seesAllLeads(user) && <Link className="crm-ck-old" href={`/admin/crm/${lead.id}`}>Presentations, matching, email →</Link>}
          </aside>
        </div>
      </div>
    </ToastProvider>
  );
}

type PartnerLeadInput = {
  id: string; status: string; contactRepName: string | null; contactRepPhone: string | null;
  deals: { commissionStatus: string }[];
  claims: Parameters<typeof buildCockpitPartnerCard>[0]["claims"];
};

// Partner card data (phase 3b): only for leads that carry a claim; the two extra
// queries run only then, so leads without partners render exactly as before.
async function loadPartnerView(lead: PartnerLeadInput, canEdit: boolean, canReview: boolean, now: Date): Promise<CockpitPartnerView | null> {
  if (!lead.claims.length) return null;
  const [last, messages] = await Promise.all([
    prisma.leadInteraction.findFirst({
      where: { leadId: lead.id, type: { in: [...REAL_CONTACT_TYPES] } },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
    prisma.partnerMessage.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: PARTNER_MESSAGES_CAP,
      select: {
        id: true, body: true, createdAt: true, author: { select: { name: true } },
        partner: { select: { company: true, firstName: true, lastName: true } },
      },
    }),
  ]);
  const built = buildCockpitPartnerCard({
    claims: lead.claims.map((c) => ({ ...c, state: c.state as ClaimStateValue })),
    lead: {
      status: lead.status, hasDeal: lead.deals.some((d) => d.commissionStatus !== "CANCELLED"),
      lastRealContactAt: last?.occurredAt ?? null, contactRepName: lead.contactRepName, contactRepPhone: lead.contactRepPhone,
    },
    now,
  });
  if (!built) return null;
  return {
    leadId: lead.id,
    card: built.card,
    inReview: built.inReview,
    messages: messages.map((m) => ({
      id: m.id, author: m.author?.name ?? "Former team member", partner: messagePartnerLabel(m.partner),
      createdAt: m.createdAt.toISOString(), body: m.body,
    })),
    canMessage: canEdit && built.hasActive,
    canReview,
  };
}
