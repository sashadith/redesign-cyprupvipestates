// WhatsApp messages from the OpenWA gateway: customer messages (message.received) and, since
// 2026-10-29, the operator's own (message.sent) — see lib/openwa/trackMessage.ts.
//
// First registered against the gateway session for the "message" event. Before this
// existed no webhook was registered at all and WHATSAPP_IN was, in the words
// of crm/interactionHelpers.ts, "not written anywhere yet" — so every customer
// reply was invisible to the CRM unless someone typed it in. 59 leads messaged,
// 13 with a reply on file, all 14 inbound rows hand-entered (2026-10-17).
//
// Authenticated with a shared secret, compared in constant time. The gateway
// runs on 127.0.0.1 beside the app, but nginx proxies /api publicly, so this
// endpoint IS reachable from the internet — and it writes to a lead's
// timeline and resets its follow-up cadence. An unauthenticated writer here
// could plant messages on any lead.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { realTrackDeps, trackWhatsAppMessage, type WaMessage } from "@/lib/openwa/trackMessage";
import { createOpenWaClient } from "@/lib/openwa/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function secretOk(req: NextRequest): boolean {
  const expected = process.env.OPENWA_WEBHOOK_SECRET;
  // Unset = closed, never open. An endpoint that writes to the CRM must not
  // fall open because a variable is missing from a release.
  if (!expected || expected.length < 16) return false;
  // Header OR query parameter.
  //
  // The header is the better place and was the only one at first. Then the
  // gateway turned out not to support custom headers at all: a webhook created
  // with {"headers":{...}} is accepted with 200 and the field is silently
  // dropped — a GET of the stored webhook shows id/url/events/filters/active/
  // retryCount/timestamps and nothing else (verified 2026-10-17). It would have
  // fired, been refused 401 here, and recorded nothing, with no error on either
  // side.
  //
  // So the secret also travels as `?s=`. That is normally a bad idea because
  // query strings land in access logs — which is exactly why the webhook is
  // registered against http://127.0.0.1:3000 instead of the public hostname:
  // the gateway runs on the same host, the call never reaches nginx, and
  // nothing logs the URL. The public route stays closed to anyone without the
  // secret either way.
  const given = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("s") || "";
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // burn a comparison so timing cannot reveal the length
    return false;
  }
  return timingSafeEqual(a, b);
}

/** The gateway's payload shape varies by version; read defensively. */
function extract(body: any): WaMessage | null {
  const p = body?.payload ?? body?.data ?? body;
  if (!p || typeof p !== "object") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: typeof p.id === "string" ? p.id : (typeof p.id?._serialized === "string" ? p.id._serialized : null),
    from: str(p.from),
    to: str(p.to),
    chatId: str(p.chatId),
    body: typeof p.body === "string" ? p.body : str(p.text),
    type: str(p.type),
    fromMe: p.fromMe === true,
    timestamp: typeof p.timestamp === "number" ? p.timestamp : null,
    isGroup: p.isGroup === true,
    senderPhone: str(p.senderPhone),
  };
}

export async function POST(req: NextRequest) {
  if (!secretOk(req)) {
    // The fact, never the value presented.
    console.warn("[whatsapp-inbound] unauthorized webhook refused");
    return new NextResponse(null, { status: 401 });
  }
  try {
    const msg = extract(await req.json().catch(() => null));
    if (!msg) return NextResponse.json({ status: "skipped", reason: "unparseable" });
    // Registered for message.received AND message.sent (the operator's own messages, phone included).
    const client = createOpenWaClient();
    const result = await trackWhatsAppMessage(msg, { live: true, via: "openwa-webhook" }, realTrackDeps((jid) => client.resolvePhone(jid)));
    // Always 200 on a parsed payload: a gateway that retries on non-2xx would
    // hammer this endpoint over a message we deliberately skipped (our own
    // send, a group, an unknown number).
    return NextResponse.json(result);
  } catch (e) {
    // 500 here IS wanted — a database failure should be retried by the gateway,
    // unlike a message we chose not to record.
    console.error("[whatsapp-inbound] failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
