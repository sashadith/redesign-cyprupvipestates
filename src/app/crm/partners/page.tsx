import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { partnerBankView } from "@/lib/crm/payoutRules";
import { decryptBankDetails } from "@/lib/partner/bankCrypto";
import type { BankDetails } from "@/lib/partner/bank";
import { PartnersTable, type PartnerRow } from "../components/PartnersTable";
import { ToastProvider } from "../components/Toast";
import { PartnerTelegramPanel } from "../components/PartnerTelegramPanel";
import { partnerBotConfigured } from "@/lib/partner/telegramApi";
import { PartnerTiersPanel, type TierProposalRow } from "../components/PartnerTiersPanel";
import { closedDealCounts, loadTiers } from "@/lib/partner/tierStore";
import { tierLabel } from "@/lib/partner/tierFlow";
import { loadPartnerEnquiries } from "@/lib/crm/partnerEnquiries";
import { PartnerEnquiries } from "../components/PartnerEnquiries";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Pending", status: "PENDING" },
  { key: "active", label: "Active", status: "ACTIVE" },
  { key: "suspended", label: "Suspended", status: "SUSPENDED" },
] as const;

export default async function PartnersPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/today");

  const tab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];
  const [counts, partners, managers, telegramLinked, tiers, openProposals, enquiries] = await Promise.all([
    prisma.partner.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.partner.findMany({
      where: { status: tab.status },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, status: true, type: true, firstName: true, lastName: true, company: true, country: true, language: true,
        handoverShare: true, fixShare: true, trustMode: true, refCode: true, managerUserId: true, createdAt: true,
        manager: { select: { name: true } },
        users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true, emailVerifiedAt: true } },
        acceptances: { orderBy: { acceptedAt: "desc" }, take: 1, select: { version: true } },
        bankDetailsEnc: true, ibanLast4: true, ibanChangedAt: true, vatMode: true, vatModeManual: true, vatId: true,
        telegramChatId: true, // mapped to a boolean below; the chat id never reaches the client
        tierKey: true,
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    user.isOwner ? prisma.partner.count({ where: { telegramChatId: { not: null } } }) : Promise.resolve(0),
    loadTiers(),
    prisma.partnerTierProposal.findMany({
      where: { decidedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true, fromTier: true, toTier: true, closedDeals: true, createdAt: true,
        partner: { select: { firstName: true, lastName: true, company: true, handoverShare: true, fixShare: true } },
      },
    }),
    loadPartnerEnquiries(),
  ]);
  // One batched query for the listed partners' closed deals (last 12 months).
  const closedDeals = await closedDealCounts(partners.map((p) => p.id), new Date());
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  // Decrypted here, on the server; only the masked view (no full IBAN) reaches the client.
  const now = new Date();
  const bankOf = (p: { bankDetailsEnc: string | null; ibanLast4: string | null; ibanChangedAt: Date | null }) => {
    let details: BankDetails | null = null;
    let unreadable = false;
    if (p.bankDetailsEnc) {
      try { details = decryptBankDetails(p.bankDetailsEnc); } catch { unreadable = true; }
    }
    return partnerBankView({ details, unreadable, ibanLast4: p.ibanLast4, ibanChangedAt: p.ibanChangedAt }, now);
  };

  const rows: PartnerRow[] = partners.map((p) => ({
    id: p.id, status: p.status, type: p.type, name: `${p.firstName} ${p.lastName}`, company: p.company, country: p.country, language: p.language,
    email: p.users[0]?.email ?? "", verified: !!p.users[0]?.emailVerifiedAt, registered: p.createdAt.toISOString().slice(0, 10),
    agreement: p.acceptances[0]?.version ?? null,
    handoverShare: String(Number(p.handoverShare)), fixShare: String(Number(p.fixShare)), trustMode: p.trustMode,
    refCode: p.refCode, managerUserId: p.managerUserId, managerName: p.manager?.name ?? null,
    vatMode: p.vatMode, vatModeManual: p.vatModeManual, vatId: p.vatId, bank: bankOf(p),
    telegramLinked: !!p.telegramChatId,
    tierLabel: tierLabel(p.tierKey, tiers),
    tierKey: p.tierKey,
    closedDeals12m: closedDeals.get(p.id) ?? 0,
  }));
  const proposals: TierProposalRow[] = openProposals.map((p) => {
    const to = tiers.find((t) => t.key === p.toTier) ?? null;
    return {
      id: p.id, partnerName: `${p.partner.firstName} ${p.partner.lastName}`, company: p.partner.company,
      fromLabel: tierLabel(p.fromTier, tiers), toLabel: tierLabel(p.toTier, tiers), closedDeals: p.closedDeals,
      created: p.createdAt.toISOString().slice(0, 10),
      currentShares: { handover: Number(p.partner.handoverShare), fix: Number(p.partner.fixShare) },
      tierShares: to ? { handover: to.handoverShare, fix: to.fixShare } : null,
    };
  });
  // Pending: verified first, then unverified; each oldest first (query is already oldest first, sort is stable).
  if (tab.key === "pending") rows.sort((a, b) => Number(b.verified) - Number(a.verified));

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Partners</h1>
          <p>Approve, suspend and configure partners registered on the partner portal.</p>
        </div>
        <Link href="/crm/partners/rating" className="crm-btn">Rating seasons</Link>
      </div>
      <PartnerEnquiries rows={enquiries} />
      <nav className="crm-pt-tabs" aria-label="Partner status">
        {TABS.map((t) => (
          <Link key={t.key} href={`/crm/partners?tab=${t.key}`} aria-current={t.key === tab.key ? "page" : undefined} className={`crm-chip${t.key === tab.key ? " on" : ""}`}>
            {t.label} ({countOf(t.status)})
          </Link>
        ))}
      </nav>
      {user.isOwner && <PartnerTelegramPanel configured={partnerBotConfigured()} linkedCount={telegramLinked} />}
      <ToastProvider>
        <PartnerTiersPanel
          tiers={tiers.map((t) => ({ key: t.key, name: t.name, minClosedDeals: t.minClosedDeals, handoverShare: t.handoverShare, fixShare: t.fixShare, active: t.active }))}
          proposals={proposals}
        />
        <PartnersTable
          rows={rows} managers={managers} canReveal={user.isOwner}
          tiers={tiers.filter((t) => t.active).map((t) => ({ key: t.key, name: t.name, handoverShare: t.handoverShare, fixShare: t.fixShare }))}
        />
      </ToastProvider>
    </>
  );
}
