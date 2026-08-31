import { gatherAdvisorPayload } from "./gather";
import { analyzePayload } from "./analyze";
import { filterSuppressed } from "./suppression";
import { storeAdvisorRun } from "./deliver";

// The full weekly pipeline: GATHER -> ANALYZE -> filter suppressed -> store.
// Called by /api/cron/seo-advisor (Sundays 06:00 UTC) and by the manual
// "run once" verification path — same function, same behavior either way.
//
// Suppression drops a suggestion when its fingerprint was dismissed in the
// last 90 days, or approved in the last 42 (see suppression.ts). What was
// dropped and why is returned, not just counted: a run reporting "5
// suggestions, 3 suppressed" with no names is impossible to sanity-check,
// and this filter silently did nothing at all for its first six weeks.
export async function runSeoAdvisor() {
  const payload = await gatherAdvisorPayload();
  const rawSuggestions = await analyzePayload(payload);
  const { kept, dropped } = await filterSuppressed(rawSuggestions);
  const run = await storeAdvisorRun(payload, kept);
  return {
    runId: run.id,
    runDate: run.runDate,
    suggestionCount: kept.length,
    suppressedCount: dropped.length,
    suppressed: dropped,
  };
}
