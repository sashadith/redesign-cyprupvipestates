import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

// Reads the LATEST weekly run's suggestions — only "open" ones become items.
// Dismissing/approving a suggestion (see the advisor detail page's server
// actions) flips its status directly, which is enough to remove it here; no
// separate snooze needed for this category.
export async function seoAdvisorRules(): Promise<ActionItem[]> {
  const latest = await prisma.advisorRun.findFirst({ orderBy: { runDate: "desc" } });
  if (!latest) return [];
  const suggestions = (latest.suggestions as unknown as StoredSuggestion[]) ?? [];
  return suggestions
    .filter((s) => s.status === "open")
    .map((s) => ({
      id: `seo-advisor:${s.id}`,
      severity: "INFO",
      category: "SEO_ADVISOR",
      title: s.title,
      description: `${s.rationale} — impact: ${s.impact_estimate}, effort: ${s.effort}.`,
      deepLink: "/admin/analytics/seo/advisor",
      since: latest.runDate,
    }));
}
