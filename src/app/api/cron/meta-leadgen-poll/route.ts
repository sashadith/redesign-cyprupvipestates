import { NextRequest, NextResponse } from "next/server";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { listForms, listLeadsSince, parseSinceHours, MetaConfigError, MetaTokenError } from "@/lib/metaLeadgen/graph";
import { processLeadgen, resendOwedNotifications, unfinishedLeadgenIds, type ProcessResult } from "@/lib/metaLeadgen/processLead";
import { alertBoth, tokenAlertText, TOKEN_ALERT_SUBJECT } from "@/lib/metaLeadgen/notify";
import { autoSinceHours, checkCronFreshness, markTokenAlerted, tokenAlertDue } from "@/lib/metaLeadgen/watchdog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB = "meta-leadgen-poll";

type Summary = {
  forms: number;
  seen: number;
  created: number;
  attached: number;
  skipped: number;
  failed: { leadgenId: string; error: string }[];
  resent: number;
  swept: number;
  tokenError: string | null;
  configError: string | null;
  sinceHours: number;
};

async function poll(sinceHours: number): Promise<Summary> {
  const s: Summary = { forms: 0, seen: 0, created: 0, attached: 0, skipped: 0, failed: [], resent: 0, swept: 0, tokenError: null, configError: null, sinceHours };
  const since = new Date(Date.now() - sinceHours * 3_600_000);
  const tally = (leadgenId: string, r: ProcessResult) => {
    if (r.status === "created") s.created++;
    else if (r.status === "attached") s.attached++;
    else if (r.status === "skipped") s.skipped++;
    else if (r.status === "failed") {
      s.failed.push({ leadgenId, error: r.error });
      if (r.tokenError) s.tokenError = r.error;
    }
  };
  try {
    const forms = await listForms();
    s.forms = forms.length;
    for (const form of forms) {
      let leads;
      try {
        leads = await listLeadsSince(form.id, since);
      } catch (e) {
        // One form's listing failing must not hide the other forms' leads.
        if (e instanceof MetaTokenError) throw e;
        s.failed.push({ leadgenId: `form:${form.id} (${form.name})`, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      for (const lead of leads) {
        s.seen++;
        tally(lead.id, await processLeadgen({ leadgenId: lead.id, formId: form.id, prefetched: { ...lead, form_id: lead.form_id ?? form.id }, via: "poller" }));
      }
    }
    // Anything that failed or got stuck, of ANY age — the window above alone
    // would silently age a lead out after 48 h.
    for (const u of await unfinishedLeadgenIds()) {
      if (s.tokenError) break;
      s.swept++;
      tally(u.leadgenId, await processLeadgen({ leadgenId: u.leadgenId, formId: u.formId, via: "poller" }));
    }
  } catch (e) {
    if (e instanceof MetaTokenError) s.tokenError = e.message;
    else if (e instanceof MetaConfigError) s.configError = e.message;
    else throw e;
  }
  s.resent = await resendOwedNotifications();
  return s;
}

const okFrom = (s: Summary) => !s.tokenError && !s.configError && s.failed.length === 0;

// Called by cron: curl -s "http://127.0.0.1:3000/api/cron/meta-leadgen-poll?key=$CRON_SECRET"
// Every 15 minutes (1,16,31,46). One-off catch-up: add &sinceHours=168.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const explicit = req.nextUrl.searchParams.get("sinceHours");
  const sinceHours = explicit ? parseSinceHours(explicit) : await autoSinceHours(parseSinceHours(null));
  try {
    const s = await withCronLog(
      JOB,
      () => poll(sinceHours),
      (r) =>
        r.configError ??
        (r.tokenError ? `token invalid: ${r.tokenError}` : `${r.forms} form(s), ${r.seen} lead(s) in ${r.sinceHours}h — ${r.created} created, ${r.attached} attached, ${r.skipped} already done, ${r.failed.length} failed, ${r.swept} retried by id, ${r.resent} notification(s) re-sent`),
      okFrom,
    );
    // Per-lead failures already alerted once each inside processLeadgen. The
    // token gets its own message, at most daily while it stays broken. A
    // missing config is left to the Action Center (ok:false row) — expected
    // between deploy and the Meta-side setup.
    const formErrors = s.failed.filter((f) => f.leadgenId.startsWith("form:"));
    if (s.tokenError) {
      if (await tokenAlertDue()) {
        await alertBoth(TOKEN_ALERT_SUBJECT, tokenAlertText(s.tokenError));
        await markTokenAlerted();
      }
    } else if (formErrors.length && (await shouldNotifyFailureStreak(JOB, 1))) {
      await alertBoth(`${JOB}: could not list leads`, `⚠️ ${JOB} could not list leads for ${formErrors.length} form(s):\n${formErrors.map((f) => `${f.leadgenId}: ${f.error}`).join("\n")}`);
      await markFailureStreakNotified(JOB);
    }
    await checkCronFreshness("email-inbound", 20 * 60_000).catch((e) => console.error("watchdog(email-inbound) failed", e));
    return NextResponse.json({ ok: okFrom(s), ...s });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak(JOB, 1)) {
      await alertBoth(`${JOB}: cron failed`, `⚠️ ${JOB} — cron failed\n${message}\nIt retries every 15 minutes; you'll be reminded daily while it keeps failing.`);
      await markFailureStreakNotified(JOB);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
