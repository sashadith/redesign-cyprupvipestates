import type { ActionItem } from "../types";
import { loadSocialActionItems } from "@/lib/social/load";

// Social posts planned in Typefully (read-only) — see src/lib/social/socialMonitor.ts
// for the rules themselves: unconfirmed planned drafts within 72h, planned
// drafts whose date passed unconfirmed, publish errors, and the API being
// unreachable as its own item. One GET per status, memoised (5 minutes on
// success, 1 minute on failure, 5 s timeout), so even a Typefully outage adds
// at most one 5-second wait per minute to the admin pages that count items.
export async function socialRules(): Promise<ActionItem[]> {
  try {
    return await loadSocialActionItems();
  } catch (e) {
    // The loader is built not to throw; this only guards the dashboard itself.
    return [{
      id: "social-api-unreachable",
      severity: "ACTION",
      category: "SOCIAL",
      title: "Typefully check failed",
      description: `Social posts could not be checked: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300),
      deepLink: "https://typefully.com/",
      since: new Date(),
    }];
  }
}
