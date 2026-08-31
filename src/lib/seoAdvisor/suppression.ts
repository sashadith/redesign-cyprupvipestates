import { prisma } from "@/lib/prisma";
import type { Suggestion } from "./analyze";
import type { StoredSuggestion } from "./types";

// A dismissal is a decision, so one is enough. This used to require two
// within the window, which was unreachable in practice: the fingerprint
// hashed the model's freshly-written title, so no fingerprint ever recurred
// (measured 2026-08-31: 0 repeats across 40 suggestions in 10 runs) and the
// count could never reach two. Now that fingerprints are anchored on the
// pages a suggestion names, "twice" would mean deliberately waving the same
// thing away two weeks running before it stops — which is the annoyance the
// rule exists to prevent.
const DISMISS_WINDOW_DAYS = 90;

// An APPROVED suggestion is one that was acted on, so re-proposing it next
// Sunday is noise — but only for as long as the work plausibly needs to show
// up in Search Console. After that the suggestion is allowed back, and that
// is the point: if the signal is still there six weeks later, the fix did not
// work and that is worth knowing. A permanent silence would hide exactly that.
// 42 days ≈ six weekly runs, and matches the 42-day title-sweep
// re-measurement window the advisor already reasons about elsewhere.
const APPROVED_PAUSE_DAYS = 42;

const DAY = 86_400_000;

export type SuppressionReason = "dismissed" | "recently-approved";

/** Fingerprints that must not be re-proposed, with why — the caller logs it. */
export async function getSuppressedFingerprints(now = Date.now()): Promise<Map<string, SuppressionReason>> {
  const oldest = new Date(now - Math.max(DISMISS_WINDOW_DAYS, APPROVED_PAUSE_DAYS) * DAY);
  const runs = await prisma.advisorRun.findMany({
    where: { runDate: { gte: oldest } },
    select: { runDate: true, suggestions: true },
  });

  const suppressed = new Map<string, SuppressionReason>();
  for (const run of runs) {
    for (const s of ((run.suggestions as unknown as StoredSuggestion[]) ?? [])) {
      if (!s?.fingerprint) continue;

      // Prefer the explicit timestamp; fall back to the run's own date for
      // rows written before those timestamps existed.
      const stamp = (iso?: string) => {
        const t = iso ? Date.parse(iso) : NaN;
        return Number.isFinite(t) ? t : run.runDate.getTime();
      };

      if (s.status === "dismissed" && now - stamp(s.dismissedAt) <= DISMISS_WINDOW_DAYS * DAY) {
        suppressed.set(s.fingerprint, "dismissed"); // a dismissal outranks a pause
        continue;
      }
      if (s.status === "approved" && now - stamp(s.approvedAt) <= APPROVED_PAUSE_DAYS * DAY) {
        if (!suppressed.has(s.fingerprint)) suppressed.set(s.fingerprint, "recently-approved");
      }
    }
  }
  return suppressed;
}

export async function filterSuppressed(
  suggestions: Suggestion[],
): Promise<{ kept: Suggestion[]; dropped: { title: string; reason: SuppressionReason }[] }> {
  const suppressed = await getSuppressedFingerprints();
  const kept: Suggestion[] = [];
  const dropped: { title: string; reason: SuppressionReason }[] = [];
  for (const s of suggestions) {
    const reason = suppressed.get(s.fingerprint);
    if (reason) dropped.push({ title: s.title, reason });
    else kept.push(s);
  }
  return { kept, dropped };
}
