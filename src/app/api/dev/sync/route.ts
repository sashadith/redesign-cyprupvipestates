import { NextResponse } from "next/server";
import { syncDeveloper, syncAll } from "@/lib/feedSync";

// Dev-only trigger for the feed sync (the admin button comes later).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
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
