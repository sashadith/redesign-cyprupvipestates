// Daily partner tier proposals (partner portal phase 4b, Decision 3). ENGLISH (internal).
// For every ACTIVE partner (max 2000): closed deals of the last 12 months (EARNED / DEVELOPER_PAID /
// PAID_OUT, earnedAt within 365 days, on leads with the partner's committed claim) → the highest active
// tier reached (proposeTier, never a downgrade). A proposal is opened unless one is open already or the
// latest decided one was declined at the same or a higher closed-deal count. Then one English office
// Telegram lists the new proposals with a link to /crm/partners (a Telegram failure is logged, not fatal).
// The operator accepts or declines in the CRM; accepting sets the tier and shares and queues TIER_UP.
// One run at a time (advisory lock).
// Pure parts: src/lib/partner/tiers.ts, tierFlow.ts; DB side: src/lib/partner/tierStore.ts.
//
// Set PARTNER_TIERS_START (ISO, e.g. 2026-10-26T00:00:00Z): without it the job does nothing, and
// nothing runs before it.
// Crontab (03:00 UTC ≈ 05:00/06:00 Cyprus, daily):
//   0 3 * * * curl -s "http://127.0.0.1:3000/api/cron/partner-tiers?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { tiersStartFromEnv } from "@/lib/partner/tierFlow";
import { runTierProposals, withTiersLock, type TiersRunResult } from "@/lib/partner/tierStore";

export const dynamic = "force-dynamic";

type RunResult = { skipped: string } | ({ ok: true } & TiersRunResult);

async function runTiers(): Promise<RunResult> {
  const start = tiersStartFromEnv(process.env);
  if (!start) return { skipped: "PARTNER_TIERS_START not set" };
  const now = new Date();
  const crmBase = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const run = await withTiersLock(() => runTierProposals(now, start, crmBase));
  if (!run) return { skipped: "another run active" };
  if (run.errors.length) console.error("[partner-tiers]", run.errors);
  return { ok: true, ...run };
}

const summarize = (r: RunResult) => {
  if (!("ok" in r)) return `skipped: ${r.skipped}`;
  const skipped = Object.entries(r.skipped).map(([k, v]) => `${v} ${k}`).join(", ");
  return `${r.partners} partners, ${r.created} new proposals${skipped ? `, skipped (${skipped})` : ""}, telegram ${r.telegram}` +
    `${r.errors.length ? `, ${r.errors.length} errors` : ""}`;
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // A failed office Telegram is logged in errors but does not fail the run; failed inserts do.
    const result = await withCronLog("partner-tiers", runTiers, summarize, (r) => !("ok" in r) || r.errors.every((e) => e.startsWith("office telegram:")));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
