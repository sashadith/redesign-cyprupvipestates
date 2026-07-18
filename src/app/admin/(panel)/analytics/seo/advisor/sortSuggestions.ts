import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

// Open suggestions first (still actionable), closed ones (approved/dismissed)
// after — the page renders a "Completed this run" divider at the boundary.
export function sortSuggestions(suggestions: StoredSuggestion[]): StoredSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const aOpen = a.status === "open" ? 0 : 1;
    const bOpen = b.status === "open" ? 0 : 1;
    return aOpen - bOpen;
  });
}
