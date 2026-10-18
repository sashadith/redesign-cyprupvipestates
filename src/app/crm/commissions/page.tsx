import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import type { CommissionStatusValue } from "@/lib/crm/commission";
import { RatesEditor, type RateAccount } from "../components/RatesEditor";
import { DealsTable, type DealRow } from "../components/DealsTable";
import { DEALS_SHOWN, capDeals, statusTotalsOf } from "@/lib/crm/commissionTotals";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function CommissionsPage() {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  const live = { commissionStatus: { not: "CANCELLED" as const } };
  const [accounts, deals, totals] = await Promise.all([
    prisma.developerAccount.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true,
        commissionRates: { select: { id: true, developmentId: true, ratePercent: true, development: { select: { publicName: true } } } },
        developments: { select: { id: true, publicName: true, publishStatus: true }, orderBy: { publicName: "asc" } },
      },
    }),
    prisma.deal.findMany({
      where: live,
      orderBy: { createdAt: "desc" },
      take: DEALS_SHOWN + 1,
      select: {
        id: true, leadId: true, unitLabel: true, price: true, ourRatePercent: true, rateSource: true, ourCommission: true, partnerCommission: true,
        commissionStatus: true, expectedAt: true, earnedAt: true, developerPaidAt: true, paidOutAt: true,
        lead: { select: { firstName: true, lastName: true } },
        development: { select: { publicName: true } },
      },
    }),
    prisma.deal.groupBy({ by: ["commissionStatus"], where: live, _sum: { ourCommission: true }, _count: { _all: true, ourCommission: true } }),
  ]);

  const rateAccounts: RateAccount[] = accounts.map((a) => {
    const defaultRate = a.commissionRates.find((r) => r.developmentId === null);
    const overridden = new Set(a.commissionRates.map((r) => r.developmentId).filter(Boolean));
    return {
      id: a.id,
      name: a.name,
      defaultRate: defaultRate ? { id: defaultRate.id, ratePercent: defaultRate.ratePercent.toNumber() } : null,
      overrides: a.commissionRates
        .filter((r) => r.developmentId !== null)
        .map((r) => ({ id: r.id, developmentId: r.developmentId as string, projectName: r.development?.publicName ?? "Unknown project", ratePercent: r.ratePercent.toNumber() }))
        .sort((x, y) => x.projectName.localeCompare(y.projectName)),
      // Published projects first, then the rest; projects that already have an override are left out.
      projects: a.developments
        .filter((d) => !overridden.has(d.id))
        .sort((x, y) => Number(y.publishStatus === "published") - Number(x.publishStatus === "published"))
        .map((d) => ({ id: d.id, name: d.publicName, published: d.publishStatus === "published", status: d.publishStatus })),
    };
  });

  const { shown, truncated } = capDeals(deals);
  const dealRows: DealRow[] = shown.map((d) => ({
    id: d.id,
    leadId: d.leadId,
    leadName: `${d.lead.firstName} ${d.lead.lastName}`.trim() || "Unnamed lead",
    project: d.development?.publicName ?? null,
    unitLabel: d.unitLabel,
    price: d.price,
    ourRatePercent: d.ourRatePercent?.toNumber() ?? null,
    rateSource: d.rateSource,
    ourCommission: d.ourCommission,
    partnerCommission: d.partnerCommission,
    status: d.commissionStatus as CommissionStatusValue,
    expectedAt: day(d.expectedAt),
    earnedAt: day(d.earnedAt),
    developerPaidAt: day(d.developerPaidAt),
    paidOutAt: day(d.paidOutAt),
  }));

  const statusTotals = statusTotalsOf(totals);

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Commissions</h1>
          <p>Our rates per developer and project, and where each deal&apos;s commission stands.</p>
        </div>
      </div>
      <RatesEditor accounts={rateAccounts} />
      <DealsTable deals={dealRows} totals={statusTotals} today={new Date().toISOString().slice(0, 10)} truncated={truncated} />
    </>
  );
}
