// Meta Lead Ads webhook (docs/META-LEADGEN.md). GET = Meta's subscription
// handshake; POST = "page" object, "leadgen" field change events. Every event
// goes through processLeadgen — the same idempotent path the 15-minute poller
// uses — so a failure here is retried there, never lost.
import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/metaLeadgen/signature";
import { processLeadgen } from "@/lib/metaLeadgen/processLead";
import { alertBoth, tokenAlertText, TOKEN_ALERT_SUBJECT } from "@/lib/metaLeadgen/notify";
import { markTokenAlerted, tokenAlertDue } from "@/lib/metaLeadgen/watchdog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta retries a webhook that doesn't answer within ~20 s. Work still running
// past this keeps going in the background (self-hosted Node, not serverless);
// Meta just gets its 200 first.
const RESPOND_WITHIN_MS = 12_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (sp.get("hub.mode") === "subscribe" && expected && sp.get("hub.verify_token") === expected) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type LeadgenChange = { field?: string; value?: { leadgen_id?: string | number; form_id?: string | number; page_id?: string | number; ad_id?: string | number } };
type WebhookBody = { object?: string; entry?: { id?: string; changes?: LeadgenChange[] }[] };

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const pageId = process.env.META_PAGE_ID;
  const events: { leadgenId: string; formId: string | null }[] = [];
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "leadgen" || !ch.value?.leadgen_id) continue;
      const evPage = String(ch.value.page_id ?? entry.id ?? "");
      if (pageId && evPage && evPage !== pageId) continue; // another page subscribed to the same app
      events.push({ leadgenId: String(ch.value.leadgen_id), formId: ch.value.form_id ? String(ch.value.form_id) : null });
    }
  }

  const work = (async () => {
    const results = [];
    for (const ev of events) results.push(await processLeadgen({ ...ev, via: "webhook" }));
    if (results.some((r) => r.status === "failed" && r.tokenError) && (await tokenAlertDue())) {
      const detail = results.find((r) => r.status === "failed" && r.tokenError);
      await alertBoth(TOKEN_ALERT_SUBJECT, tokenAlertText(detail && detail.status === "failed" ? detail.error : ""));
      await markTokenAlerted();
    }
    return results;
  })().catch((e) => {
    // processLeadgen catches per lead; reaching here means the DB itself
    // failed before a claim. The poller retries — but say so loudly.
    console.error("meta-leadgen webhook: processing crashed", e);
    void alertBoth("Meta lead webhook crashed", `⚠️ Meta lead webhook crashed before processing: ${e instanceof Error ? e.message : String(e)}\nleadgen_ids: ${events.map((x) => x.leadgenId).join(", ")}\nThe poller will retry.`);
    return null;
  });

  const results = await Promise.race([work, new Promise<"pending">((r) => setTimeout(() => r("pending"), RESPOND_WITHIN_MS))]);
  return NextResponse.json({ ok: true, received: events.length, results: results === "pending" ? "processing" : results });
}
