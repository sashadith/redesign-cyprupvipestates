import { NextRequest, NextResponse } from "next/server";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { runSeoAdvisor } from "@/lib/seoAdvisor/run";
import { aiConfigured } from "@/lib/ai/anthropic";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

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
      // Name what was suppressed, don't just count it. "0 suppressed" read as
      // "nothing repeated itself" for six weeks, when it actually meant the
      // filter could not fire at all (its key hashed the model's own wording).
      // A line that lists the titles makes a dead filter look dead.
      (r) =>
        r.skipped
          ? `skipped: ${r.reason}`
          : `${r.suggestionCount} suggestion(s), ${r.suppressedCount} suppressed` +
            (r.suppressed?.length ? ` — ${r.suppressed.map((d) => `${d.reason}: ${d.title}`).join("; ")}` : ""),
    );
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 2026-08-13 (GROSSER AUFTRAG Teil 4) — the doc comment above only
    // covers the SUCCESS reporting path (piggybacks onto action-digest);
    // a failure here had no alerting at all until now.
    if (await shouldNotifyFailureStreak("seo-advisor")) {
      const msg = buildCronFailureMessage("seo-advisor", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("seo-advisor");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
