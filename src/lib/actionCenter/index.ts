import type { ActionItem, Category } from "./types";
import { SEVERITY_ORDER } from "./types";
import { developerRules } from "./rules/developers";
import { crmRules } from "./rules/crm";
import { systemRules } from "./rules/system";
import { seoRules } from "./rules/seo";
import { seoAdvisorRules } from "./rules/seoAdvisor";
import { filterSnoozed } from "./snooze";

export type { ActionItem, Severity, Category } from "./types";
export { snoozeItem, dismissForeverItem } from "./snooze";

// 2026-08-11 — CRM moved to the top per request (leads need the fastest
// glance), Developers second, SEO/SEO_ADVISOR/SYSTEM unchanged relative to
// each other.
const CATEGORY_ORDER: Record<Category, number> = { CRM: 0, DEVELOPERS: 1, SEO: 2, SEO_ADVISOR: 3, SYSTEM: 4 };

function sortItems(items: ActionItem[]): ActionItem[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.since.getTime() - b.since.getTime());
}

// Computed fresh on every call — no separate notification table for the items
// themselves (see types.ts header comment). Cheap: each rule module runs a
// handful of already-indexed queries.
export async function getActionCenterItems(): Promise<ActionItem[]> {
  const [developers, crm, system, seo, seoAdvisor] = await Promise.all([developerRules(), crmRules(), systemRules(), seoRules(), seoAdvisorRules()]);
  const all = await filterSnoozed([...developers, ...crm, ...system, ...seo, ...seoAdvisor]);
  return sortItems(all);
}

export type ActionCenterGroup = { category: Category; items: ActionItem[] };

export async function getActionCenterGrouped(): Promise<ActionCenterGroup[]> {
  const items = await getActionCenterItems();
  const byCategory = new Map<Category, ActionItem[]>();
  for (const item of items) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  return (Object.keys(CATEGORY_ORDER) as Category[])
    .sort((a, b) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b])
    .map((category) => ({ category, items: byCategory.get(category) ?? [] }))
    .filter((g) => g.items.length > 0);
}
