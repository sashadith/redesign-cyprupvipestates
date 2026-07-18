import { prisma } from "@/lib/prisma";
import type { Suggestion } from "./analyze";
import type { StoredSuggestion } from "./types";

const SUPPRESSION_WINDOW_DAYS = 90;
const DISMISS_THRESHOLD = 2;
const DAY = 86_400_000;

// A suggestion is suppressed once its fingerprint has been explicitly
// dismissed in DISMISS_THRESHOLD separate weekly runs within the trailing
// 90 days — the LLM re-suggesting the same thing after the user already said
// "no" twice is noise, not a nudge.
export async function getSuppressedFingerprints(): Promise<Set<string>> {
  const since = new Date(Date.now() - SUPPRESSION_WINDOW_DAYS * DAY);
  const runs = await prisma.advisorRun.findMany({ where: { runDate: { gte: since } }, select: { suggestions: true } });
  const dismissCounts = new Map<string, number>();
  for (const run of runs) {
    const suggestions = (run.suggestions as unknown as StoredSuggestion[]) ?? [];
    for (const s of suggestions) {
      if (s.status === "dismissed") dismissCounts.set(s.fingerprint, (dismissCounts.get(s.fingerprint) ?? 0) + 1);
    }
  }
  const suppressed = new Set<string>();
  for (const [fp, count] of Array.from(dismissCounts)) if (count >= DISMISS_THRESHOLD) suppressed.add(fp);
  return suppressed;
}

export async function filterSuppressed(suggestions: Suggestion[]): Promise<Suggestion[]> {
  const suppressed = await getSuppressedFingerprints();
  return suggestions.filter((s) => !suppressed.has(s.fingerprint));
}
