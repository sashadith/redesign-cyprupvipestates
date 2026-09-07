import type { ActionItem } from "@/lib/actionCenter/types";

const SEVERITY_RANK: Record<string, number> = { URGENT: 0, ACTION: 1, INFO: 2 };

export function mapWorklistItems(items: ActionItem[]) {
  const leadFollowups = items
    .filter((i) => i.id.startsWith("lead-followup:"))
    .map((i) => ({ leadId: i.id.slice("lead-followup:".length), severity: i.severity, title: i.title, description: i.description, since: i.since }))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.since.getTime() - b.since.getTime());
  const presentationIds = items.filter((i) => i.id.startsWith("presentation-")).map((i) => i.id.split(":")[1]).filter(Boolean);
  return { leadFollowups, presentationIds };
}
