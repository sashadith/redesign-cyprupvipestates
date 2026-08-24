// Heartbeat endpoint for working-hours tracking — POSTed by ActivityTracker
// (mounted in PanelLayout) once a minute while the admin tab is visible and
// the user has produced real input within the last 3 minutes. Write-throttled
// and isActive-gated in recordAdminActivity; report at /admin/users/activity.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordAdminActivity, moduleFromPath } from "@/lib/adminActivity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!uid) return new NextResponse(null, { status: 401 });
  // Body: { path: "/admin/crm/..." }. Tolerate a missing/invalid body —
  // beats from an old client bundle (open tab from before this deploy)
  // still count, just without a module label.
  // NB: not named `module` — Next's no-assign-module-variable ESLint rule
  // errors the build on that (CommonJS shadowing), and `tsc` alone won't
  // catch it.
  let mod: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.path === "string" && body.path.length <= 500) mod = moduleFromPath(body.path);
  } catch { /* no body — old client */ }
  await recordAdminActivity(uid, mod);
  return new NextResponse(null, { status: 204 });
}
