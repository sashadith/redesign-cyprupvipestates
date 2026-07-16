import { NextRequest, NextResponse } from "next/server";
import { syncDeveloper, syncAll } from "@/lib/feedSync";
import { auth } from "@/auth";
import crypto from "node:crypto";

// Manual feed-sync trigger — an admin session OR CRON_SECRET (for scripted/
// ops use, same header-only + constant-time pattern as
// api/cron/publish-scheduled). Was unauthenticated on live production until
// this fix (Phase 4.3) — anyone who found the URL could trigger a full feed
// sync (mirrors images, can take minutes) with no login at all.
function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const got = req.headers.get("authorization") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session && !cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dev = url.searchParams.get("dev");
  const mirror = url.searchParams.get("mirror") === "1";
  const started = Date.now();
  try {
    const result = dev && dev !== "all" ? [await syncDeveloper(dev, { mirror })] : await syncAll({ mirror });
    return NextResponse.json({ ok: true, mirror, ms: Date.now() - started, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
