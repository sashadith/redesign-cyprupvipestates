// Heartbeat endpoint for working-hours tracking — POSTed by ActivityTracker
// (mounted in PanelLayout) once a minute while the admin tab is visible and
// the user has produced real input within the last 3 minutes. Write-throttled
// and isActive-gated in recordAdminActivity; report at /admin/users/activity.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordAdminActivity } from "@/lib/adminActivity";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!uid) return new NextResponse(null, { status: 401 });
  await recordAdminActivity(uid);
  return new NextResponse(null, { status: 204 });
}
