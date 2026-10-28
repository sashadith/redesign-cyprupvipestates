import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads, canEditLead, canViewLead, seesAllLeads } from "@/lib/crm/access";
import type { CommissionStatusValue } from "@/lib/crm/commission";
import { toTimeline } from "@/lib/crm/timeline";
import { REAL_CONTACT_TYPES } from "@/lib/partner/claims";
import { buildCockpitPartnerCard, messagePartnerLabel, type ClaimStateValue } from "@/lib/crm/partnerClaims";
import { CockpitContact, CockpitHeader, type CockpitLead } from "../../components/CockpitHeader";
import { temperaturesFor } from "@/lib/crm/insights/temperatureQuery";
import { toPublicTemperature } from "@/lib/crm/insights/temperatureWiring";
import { CockpitStage } from "../../components/CockpitStage";
import { CockpitDeals } from "../../components/CockpitDeals";
import { CockpitLogForm } from "../../components/CockpitLogForm";
import { CockpitTimeline } from "../../components/CockpitTimeline";
import { CockpitAssign } from "../../components/CockpitAssign";
import { CockpitSummary } from "../../components/CockpitSummary";
import { CockpitRegistrations, type DueRow, type RegistrationRow } from "../../components/CockpitRegistrations";
import { CockpitPresentations, type PresentationRowView } from "../../components/CockpitPresentations";
import { buildPresentationRows, loadLeadPresentations } from "@/lib/crm/presentations/rows";
import { loadRegistrationDue } from "@/lib/crm/registration/due";
import { DEFAULT_SUMMARY_LOCALE, isSummaryLocale } from "@/lib/crm/summaryLocale";
import { CockpitPartner, type CockpitPartnerView } from "../../components/CockpitPartner";
import { ToastProvider } from "../../components/Toast";
import { CreatedToast } from "../../components/CreatedToast";
import { TrashLeadButton } from "../../components/TrashLeadButton";
import { EditLeadButton } from "../../components/EditLeadButton";
import type { DealRow } from "../../components/DealsTable";

export const dynamic = "force-dynamic";

const TIMELINE_CAP = 100;
const PARTNER_MESSAGES_CAP = 50;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Lead cockpit (CRM v2, 2026-10-18). A lead that does not exist and one the
// user may not see look the same: 404.
export default async function LeadCockpitPage({ params, searchParams }: { params: { id: string }; searchParams?: { created?: string | string[]; register?: string | string[] } }) {
  const user = await requireCrmUser();
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, nationality: true, countryOfResidence: true,
      languagePreference: true, salutation: true, budgetMin: true, budgetMax: true, timeline: true, financing: true, propertyTypeInterest: true,
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
          creditNote: { select: { id: true, number: true } },
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
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { crmSummaryLocale: true } });
  const summaryLocale = isSummaryLocale(me?.crmSummaryLocale) ? me.crmSummaryLocale : DEFAULT_SUMMARY_LOCALE;

  const now = new Date();
  const presentations: PresentationRowView[] = buildPresentationRows(await loadLeadPresentations(lead.id), now).map((p) => ({
    id: p.id, token: p.token, effectiveStatus: p.effectiveStatus,
    createdAt: p.createdAt.toISOString(), expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
    advisorName: p.advisorName, partnerName: p.partnerName,
    viewCount: p.viewCount, uniqueDays: p.uniqueDays, favoritedCount: p.favoritedCount,
    items: p.items.map((i) => ({ developmentId: i.developmentId, name: i.name, isFavorited: i.isFavorited, views: i.views, durationSec: i.durationSec })),
  }));
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
  const temperature = toPublicTemperature(
    (await temperaturesFor([{ id: lead.id, status: lead.status, timeline: lead.timeline, budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, createdAt: lead.createdAt }], now)).get(lead.id),
  );
  const deals: DealRow[] = lead.deals.map((d) => ({
    id: d.id, leadId: lead.id, leadName: name, project: d.development?.publicName ?? null, unitLabel: d.unitLabel, price: d.price,
    ourRatePercent: d.ourRatePercent?.toNumber() ?? null, rateSource: d.rateSource, ourCommission: d.ourCommission, partnerCommission: d.partnerCommission,
    status: d.commissionStatus as CommissionStatusValue,
    expectedAt: day(d.expectedAt), earnedAt: day(d.earnedAt), developerPaidAt: day(d.developerPaidAt), paidOutAt: day(d.paidOutAt),
    creditNote: d.creditNote,
  }));
  const timeline = toTimeline(lead.interactions.slice(0, TIMELINE_CAP));
  const registrations: RegistrationRow[] = (await prisma.developerRegistration.findMany({
    where: { leadId: lead.id },
    include: { developerAccount: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })).map((r) => ({
    id: r.id, developerName: r.developerAccount.name, channel: r.channel === "WHATSAPP" ? "WHATSAPP" : "EMAIL", status: r.status,
    sentAt: r.sentAt?.toISOString() ?? null, preliminaryAt: r.preliminaryAt?.toISOString() ?? null, preliminarySource: r.preliminarySource,
    fixedAt: r.fixedAt?.toISOString() ?? null, sendError: r.sendError,
  }));
  const dueLead = (await loadRegistrationDue([lead.id], now))[0];
  const dueRow = (p: NonNullable<typeof dueLead>["due"][number]): DueRow => ({
    developerAccountId: p.developerAccountId, developerName: p.developerName, registrable: p.registrable,
    developmentIds: p.developmentIds, projects: p.projects, since: p.since.toISOString(),
  });
  const due = {
    open: (dueLead?.due ?? []).map(dueRow),
    skipped: (dueLead?.skipped ?? []).map((p) => ({ ...dueRow(p), skippedAt: p.skippedAt.toISOString(), skippedByName: p.skippedByName, skipReason: p.skipReason })),
  };

  return (
    <ToastProvider>
      <CreatedToast show={searchParams?.created === "1"} />
      <div className="crm-cockpit">
        <CockpitHeader lead={view} now={now} temperature={temperature} actions={canEdit ? (
          <>
            <EditLeadButton leadId={lead.id} lead={{
              firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone, salutation: lead.salutation,
              languagePreference: lead.languagePreference, budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, timeline: lead.timeline,
              financing: lead.financing, nationality: lead.nationality, countryOfResidence: lead.countryOfResidence, message: lead.message, notes: lead.notes,
            }} />
            <TrashLeadButton leadId={lead.id} leadName={name} />
          </>
        ) : null} />
        <div className="crm-ck-grid">
          <div className="crm-ck-main">
            <CockpitStage leadId={lead.id} leadName={name} status={lead.status} canEdit={canEdit} />
            <CockpitSummary leadId={lead.id} initialLocale={summaryLocale} />
            <CockpitLogForm leadId={lead.id} canEdit={canEdit} />
            <CockpitTimeline items={timeline} now={now} truncated={lead.interactions.length > TIMELINE_CAP} />
          </div>
          <aside className="crm-ck-aside">
            <CockpitContact lead={view} />
            <CockpitRegistrations leadId={lead.id} canEdit={canEdit} isOwner={user.isOwner} rows={registrations} due={due} isAdmin={seesAllLeads(user)} autoRegister={searchParams?.register === "due"} />
            <CockpitPresentations leadId={lead.id} rows={presentations} canEdit={canEdit} isOwner={user.isOwner} />
            {partnerView && <CockpitPartner view={partnerView} />}
            <CockpitDeals deals={deals} canPayout={canAssign} today={now.toISOString().slice(0, 10)} />
            {canAssign && <CockpitAssign leadId={lead.id} ownerId={lead.assignedToId} staff={staff} />}
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
