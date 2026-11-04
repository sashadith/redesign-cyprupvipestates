import { prisma } from "@/lib/prisma";
import { addDays, contractStatus, currentContract, dateToIso, fmtDay, nicosiaToday, whenText } from "@/lib/developerContract";
import type { ActionItem } from "../types";

// Developer contracts that do not renew themselves (2026-10-29): an item from
// 14 days before the end until a newer contract or new dates are entered.
// The end date is part of the id, so changed dates make a new item (a snooze
// on the old date does not hide the new one). The daily digest skips these —
// developerContractReminders.ts sends each as its own message instead.
// "No contract" is not an item: with most developers still without one it
// would bury the panel; the sidebar dot shows it.
export const CONTRACT_ITEM_PREFIX = "contract:";

export async function contractRules(now: Date = new Date()): Promise<ActionItem[]> {
  const today = nicosiaToday(now);
  const accounts = await prisma.developerAccount.findMany({
    where: { contracts: { some: { autoRenew: false } } },
    select: { id: true, name: true, contracts: { select: { id: true, signedAt: true, termMonths: true, autoRenew: true, createdAt: true } } },
  });
  const items: ActionItem[] = [];
  for (const a of accounts) {
    const c = currentContract(a.contracts);
    if (!c) continue;
    const st = contractStatus({ signedAt: dateToIso(c.signedAt), termMonths: c.termMonths, autoRenew: c.autoRenew }, today);
    if (st.kind !== "expiring" && st.kind !== "expired") continue;
    items.push({
      id: `${CONTRACT_ITEM_PREFIX}${c.id}:${st.endDate}`,
      severity: st.kind === "expired" || st.daysLeft <= 1 ? "URGENT" : "ACTION",
      category: "DEVELOPERS",
      title: `Contract with ${a.name} ${whenText(st.daysLeft)} (${fmtDay(st.endDate)})`,
      description: st.kind === "expired"
        ? "No automatic renewal. Upload the renewed contract, or correct the dates if they are wrong."
        : "No automatic renewal. Renew it with the developer, then upload the new contract.",
      deepLink: `/admin/developments/developers/${a.id}`,
      since: new Date(`${st.kind === "expired" ? st.endDate : addDays(st.endDate, -14)}T00:00:00Z`),
    });
  }
  return items;
}

