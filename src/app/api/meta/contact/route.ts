// Server copy of the browser's Meta "Contact" event (WhatsApp, phone, e-mail
// clicks). The click itself goes to WhatsApp or the dialer and never reaches us,
// so the browser beacons the event id here (src/lib/metaContact.ts). No
// personal data: only the cookies and headers the request carries anyway.
import { NextResponse } from "next/server";
import { guardRequest, makeRateLimiter, safeUrl } from "@/lib/antispam";
import { capiContextFrom, sendCapiEvent } from "@/lib/metaCapi";

const ipLimiter = makeRateLimiter();
const done = () => new NextResponse(null, { status: 204 });

const KNOWN = /^[a-z_]{1,40}$/;

export async function POST(request: Request) {
  if (guardRequest(request, ipLimiter)) return done();
  let body: any;
  try { body = await request.json(); } catch { return done(); }

  const page = safeUrl(String(body?.url ?? ""));
  const ref = safeUrl(request.headers.get("referer") || "");
  if (!page || !ref || ref.hostname !== page.hostname) return done();

  const customData: Record<string, string> = {};
  for (const k of ["method", "placement"] as const) {
    const v = String(body?.[k] ?? "");
    if (KNOWN.test(v)) customData[k] = v;
  }

  // Awaited here (unlike the lead routes): a beacon doesn't wait for the
  // reply, so the time costs the visitor nothing.
  await sendCapiEvent({
    eventName: "Contact",
    eventId: String(body?.eventId ?? ""),
    eventSourceUrl: page.toString(),
    ctx: capiContextFrom(request),
    customData,
  });
  return done();
}
