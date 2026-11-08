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
import { listHandoverRequests } from "@/lib/crm/handoverReview";
import { HandoverRequests } from "../components/HandoverRequests";
import Link from "next/link";
import { countDownloads, listDownloads, DOWNLOADS_CAP } from "@/lib/crm/downloads";
import { DownloadsList } from "../components/DownloadsList";

export const dynamic = "force-dynamic";

const INBOX_CAP = 200;

const SOURCE_LABEL: Record<string, string> = { PARTNER: "Partner", META_LEAD_AD: "Meta ad", CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Website", BLOG_ENQUIRY: "Website", WHATSAPP: "WhatsApp" };

// Two tabs (operator, 2026-11-07): Leads = work to hand out; Downloads = guide and
// Private Collection briefing readers, kept out of every work view until taken over.
function Tabs({ tab, leads, downloads }: { tab: "leads" | "downloads"; leads: number; downloads: number }) {
  return (
    <nav className="crm-pt-tabs" aria-label="Inbox">
      <Link href="/crm/inbox" aria-current={tab === "leads" ? "page" : undefined} className={`crm-chip${tab === "leads" ? " on" : ""}`}>Leads ({leads})</Link>
      <Link href="/crm/inbox?tab=downloads" aria-current={tab === "downloads" ? "page" : undefined} className={`crm-chip${tab === "downloads" ? " on" : ""}`}>Downloads ({downloads})</Link>
    </nav>
  );
}

export default async function InboxPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  if (searchParams?.tab === "downloads") {
    const [rows, downloads, leads] = await Promise.all([listDownloads(), countDownloads(), prisma.lead.count({ where: inboxWhere() })]);
    return (
      <>
        <div className="crm-headrow">
          <div>
            <h1>Inbox</h1>
            <p>{downloads === 0 ? "No downloads." : `${downloads} guide and briefing download${downloads === 1 ? "" : "s"}${downloads > DOWNLOADS_CAP ? `, showing the newest ${DOWNLOADS_CAP}` : ""} · no owner, no reminders until taken over as a lead`}</p>
          </div>
        </div>
        <Tabs tab="downloads" leads={leads} downloads={downloads} />
        <DownloadsList rows={rows} canTakeOver={canAssignLeads(user)} />
      </>
    );
  }

  const [leads, total, staff, loads, claims, handovers, downloads] = await Promise.all([
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
    listHandoverRequests(user).catch((e) => { console.error("Handover requests failed:", e instanceof Error ? e.name : "error"); return { cards: [], total: 0 }; }),
    countDownloads(),
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
      <Tabs tab="leads" leads={total} downloads={downloads} />
      <HandoverRequests items={handovers.cards} total={handovers.total} />
      <ClaimReview cards={claims.cards} total={claims.total} />
      <InboxList items={items} staff={staff.map((s) => ({ id: s.id, name: s.name, acceptsLeads: s.acceptsLeads }))} />
    </>
  );
}
