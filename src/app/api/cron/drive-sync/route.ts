import { NextRequest, NextResponse } from "next/server";
import { syncAllDrives } from "@/lib/driveAvailabilitySync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily availability sync for every developer with a Drive folder link.
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/drive-sync?key=$CRON_SECRET"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const content = req.nextUrl.searchParams.get("content") === "1";
  const force = req.nextUrl.searchParams.get("force") === "1";
  const results = await syncAllDrives(force, content);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), content, force, results });
}
