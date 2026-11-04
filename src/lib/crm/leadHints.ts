import { countryOf } from "./countryInfo";

// Soft warnings about a lead's data (2026-11-04), computed on every read rather than stored, so they
// follow edits to the lead. Shown in the cockpit, in the new-lead Telegram and in the MCP lead rows.
// Pure and import-free apart from countryInfo (the cockpit is server-rendered, but keep it light).

export type HintLead = {
  source: string;
  countryOfResidence: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

/* Meta lead forms ask for a budget in euros, but a buyer outside the euro area may have answered in
   their own currency (a "3 million" from South Africa is ~150,000 euros in rand). Flag it; never
   convert. Only with a budget on file and a known country. */
export function budgetCurrencyUnverified(l: HintLead): boolean {
  if (l.source !== "META_LEAD_AD") return false;
  if (l.budgetMin == null && l.budgetMax == null) return false;
  const c = countryOf(l.countryOfResidence);
  return !!c && !c.euro;
}

export type LeadHints = { budgetCurrencyUnverified: boolean; messages: string[] };

export function leadHints(l: HintLead): LeadHints {
  const messages: string[] = [];
  const budget = budgetCurrencyUnverified(l);
  if (budget) messages.push(`Budget possibly in local currency (${countryOf(l.countryOfResidence)!.name}), not euros`);
  return { budgetCurrencyUnverified: budget, messages };
}
