import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { PartnersTable, type PartnerRow } from "../components/PartnersTable";
import { ToastProvider } from "../components/Toast";

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
  const [counts, partners, managers] = await Promise.all([
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
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  const rows: PartnerRow[] = partners.map((p) => ({
    id: p.id, status: p.status, type: p.type, name: `${p.firstName} ${p.lastName}`, company: p.company, country: p.country, language: p.language,
    email: p.users[0]?.email ?? "", verified: !!p.users[0]?.emailVerifiedAt, registered: p.createdAt.toISOString().slice(0, 10),
    agreement: p.acceptances[0]?.version ?? null,
    handoverShare: String(Number(p.handoverShare)), fixShare: String(Number(p.fixShare)), trustMode: p.trustMode,
    refCode: p.refCode, managerUserId: p.managerUserId, managerName: p.manager?.name ?? null,
  }));
  // Pending: verified first, then unverified; each oldest first (query is already oldest first, sort is stable).
  if (tab.key === "pending") rows.sort((a, b) => Number(b.verified) - Number(a.verified));

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Partners</h1>
          <p>Approve, suspend and configure partners registered on the partner portal.</p>
        </div>
      </div>
      <div className="crm-pt-tabs" role="tablist" aria-label="Partner status">
        {TABS.map((t) => (
          <Link key={t.key} href={`/crm/partners?tab=${t.key}`} role="tab" aria-selected={t.key === tab.key} className={`crm-chip${t.key === tab.key ? " on" : ""}`}>
            {t.label} ({countOf(t.status)})
          </Link>
        ))}
      </div>
      <ToastProvider>
        <PartnersTable rows={rows} managers={managers} />
      </ToastProvider>
    </>
  );
}
