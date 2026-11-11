// The OpenWA gateway's session status for the admin nav's dot, fetched by the
// sidebar after the page has rendered (same shape as action-center-count: a
// decoration must never delay the page it decorates).
//
// Read-only. It asks the gateway the one question the status dot needs and
// raises nothing — the alerting lives in api/cron/whatsapp-health.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createOpenWaClient } from "@/lib/openwa/client";
import { McpConfigError } from "@/lib/mcp/publicOrigin";
import { openwaNavStatus } from "@/lib/openwa/navStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!uid) return new NextResponse(null, { status: 401 });
  // Same re-check the layout does: a user deactivated five minutes ago must not
  // keep pulling admin data for the rest of their token's lifetime (audit M3).
  // ADMIN only — the nav entry this feeds is ADMIN-only, and the gateway's
  // state is not an editor's business.
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true, role: true } });
  if (!user?.isActive || user.role !== "ADMIN") return new NextResponse(null, { status: 401 });

  // Three outcomes, and they must stay apart: a status the gateway reported, a
  // gateway that did not answer (null → alarm), and no OPENWA_* configuration
  // in this environment (→ no dot, not a red one; see navStatus.ts).
  let raw: string | null;
  try {
    raw = (await createOpenWaClient().getSession()).status;
  } catch (e) {
    // readOpenWaConfig throws McpConfigError for a missing/mangled variable;
    // anything else (ToolError "gateway unreachable", a timeout) is a gateway
    // that is really not answering.
    raw = e instanceof McpConfigError ? "unconfigured" : null;
  }

  return NextResponse.json(
    { status: raw, ...openwaNavStatus(raw) },
    // The dot is allowed to be a minute stale; the sidebar polls at that rate.
    { headers: { "Cache-Control": "no-store" } },
  );
}
