import type { ActionItem } from "../types";
import { loadSocialActionItems } from "@/lib/social/load";

// Social posts planned in Typefully (read-only) — see src/lib/social/socialMonitor.ts
// for the rules themselves: unconfirmed planned drafts within 72h, planned
// drafts whose date passed unconfirmed, publish errors, and the API being
// unreachable as its own item. One GET per status, memoised for 5 minutes, so
// this is never the slowest rule on the dashboard.
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
