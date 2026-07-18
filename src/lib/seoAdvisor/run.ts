import { gatherAdvisorPayload } from "./gather";
import { analyzePayload } from "./analyze";
import { filterSuppressed } from "./suppression";
import { storeAdvisorRun } from "./deliver";

// The full weekly pipeline: GATHER -> ANALYZE -> filter suppressed (90-day
// dismiss-twice rule) -> store. Called by /api/cron/seo-advisor (Sundays
// 06:00 UTC) and by the manual "run once" verification path — same function,
// same behavior either way.
export async function runSeoAdvisor() {
  const payload = await gatherAdvisorPayload();
  const rawSuggestions = await analyzePayload(payload);
  const suggestions = await filterSuppressed(rawSuggestions);
  const run = await storeAdvisorRun(payload, suggestions);
  return {
    runId: run.id,
    runDate: run.runDate,
    suggestionCount: suggestions.length,
    suppressedCount: rawSuggestions.length - suggestions.length,
  };
}
