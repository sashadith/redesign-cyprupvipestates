import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { runSeoAdvisor } from "@/lib/seoAdvisor/run";
import { aiConfigured } from "@/lib/ai/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function run() {
  if (!aiConfigured()) {
    return { skipped: true as const, reason: "ANTHROPIC_API_KEY not configured" };
  }
  const result = await runSeoAdvisor();
  return { skipped: false as const, ...result };
}

// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/seo-advisor?key=$CRON_SECRET"
// Expected schedule: Sundays 06:00 UTC. The Telegram summary is NOT sent from
// here — it piggybacks onto the next daily action-digest run (effectively
// Monday 08:00 Cyprus), see that route's telegramSentAt check.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog(
      "seo-advisor",
      run,
      (r) => (r.skipped ? `skipped: ${r.reason}` : `${r.suggestionCount} suggestion(s), ${r.suppressedCount} suppressed`),
    );
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
