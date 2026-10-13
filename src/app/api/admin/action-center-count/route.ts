// The Action Center's item count, fetched by the sidebar after the page has
// already rendered.
//
// It used to be computed inside the admin layout, which meant every single
// admin page waited for it. Measured on the server 2026-10-13, three runs:
// 1835 / 2491 / 2065 ms, against 72 ms for all seven of the layout's own
// queries combined. The slowest rule is `seo` at 1407 ms — note that the
// comment in actionCenter/index.ts still names `developers`, which was true
// when it was written and is not any more (762 ms today). The six rules run
// under one Promise.all on a 2-core box, so they also compete for CPU: summed
// they are 3.9 s, in parallel 2.0 s rather than the 1.4 s the slowest alone
// would suggest.
//
// Nothing is cached here. The panel's contract is that an item exists exactly
// while its condition holds, and that is unchanged — the work simply no longer
// blocks the page it decorates.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActionCenterItems } from "@/lib/actionCenter";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!uid) return new NextResponse(null, { status: 401 });
  // Same re-check the layout does: a user deactivated five minutes ago must not
  // keep pulling admin data for the rest of their token's lifetime (audit M3).
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user?.isActive) return new NextResponse(null, { status: 401 });

  const started = Date.now();
  const count = (await getActionCenterItems()).length;
  // Server-Timing is read by browser devtools without any client code, so the
  // cost of this endpoint stays visible once the badge no longer blocks anything.
  return NextResponse.json(
    { count },
    { headers: { "Server-Timing": `actionCenter;dur=${Date.now() - started}` } },
  );
}
