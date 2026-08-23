import type { ActionItem, Category } from "./types";
import { SEVERITY_ORDER } from "./types";
import { developerRules } from "./rules/developers";
import { crmRules } from "./rules/crm";
import { systemRules } from "./rules/system";
import { seoRules } from "./rules/seo";
import { seoAdvisorRules } from "./rules/seoAdvisor";
import { pagePowerRules } from "./rules/pagePower";
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
// themselves (see types.ts header comment).
//
// It used to say "Cheap: each rule module runs a handful of already-indexed
// queries", and that has not been true for a while. Measured 2026-08-23 against
// production over the SSH tunnel, three consecutive runs, each rule timed on its
// own and then the whole thing as it actually runs:
//
//   developers 2650/1044/1053   system 899/940/1047   seo 843/665/730
//   crm 784/746/411             pagePower 698/708/558  seoAdvisor 111/110/164
//   getActionCenterItems (all six in parallel) 2217/1920/2223
//
// So a dashboard load spends about two seconds here, and because the six run
// under one `Promise.all` that figure is the SLOWEST rule, not the sum. The
// slowest is `developers`. Adding a rule costs nothing unless it is slower than
// that one.
//
// Worth recording because the obvious suspect is the wrong one: `pagePower` is
// the heaviest rule by data volume — ~27k `SearchMetric` rows, ~8.8k `PageView`
// rows, six CMS table scans and the canonical map, per call — and is still the
// second CHEAPEST of the six and never on the critical path. Its cost is warm
// and flat (698ms first call, 708ms second), because the row counts are large
// but the queries are indexed and the work is in-process aggregation.
//
// No cache: the whole contract of this panel is that an item exists exactly
// while its condition holds (types.ts), and a stale item is a worse failure than
// a slow one. `src/lib/seoAdvisor/gather.ts` calls the same two Page Power
// functions again, but from the weekly advisor cron only — never inside a
// request that also renders this panel — so nothing is recomputed per load.
export async function getActionCenterItems(): Promise<ActionItem[]> {
  const [developers, crm, system, seo, seoAdvisor, pagePower] = await Promise.all([
    developerRules(), crmRules(), systemRules(), seoRules(), seoAdvisorRules(), pagePowerRules(),
  ]);
  const all = await filterSnoozed([...developers, ...crm, ...system, ...seo, ...seoAdvisor, ...pagePower]);
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
