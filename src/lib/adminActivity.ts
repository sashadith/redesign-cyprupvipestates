import { prisma } from "@/lib/prisma";

// Working-hours activity tracking (2026-08-24, reworked same day). The write
// path is the /api/admin/activity-ping route, called by the client-side
// ActivityTracker mounted in PanelLayout — NOT the layout's server render.
// The first version pinged from the layout itself, which had two blind spots:
// it fired on any request (so an abandoned tab that happened to reload, or a
// prefetch, looked like work), and it saw nothing between navigations (so 20
// minutes of real editing inside one page looked like absence). The client
// tracker instead beats once a minute ONLY while the tab is visible and the
// user has produced real input (mouse/keyboard/scroll/touch) within the last
// 3 minutes — the "3 Minuten keine Aktivität = Tab ist tot" rule. See
// src/app/admin/(panel)/ActivityTracker.tsx for the beat conditions and
// src/lib/adminActivityReport.ts for how beats become sessions.
//
// Server-side throttle: the client beats every 60s; 50s here (just under the
// beat interval) dedupes accidental double-sends (remount, retry) without
// ever swallowing a legitimate beat. Per Node process — PM2 runs 2 cluster
// instances, so worst case a duplicate row slips through when consecutive
// beats land on different instances; clustering absorbs that completely.
const PING_THROTTLE_MS = 50_000;
const lastPing = new Map<string, number>();

// Closed vocabulary of module labels, aligned with the sidebar's module
// structure (buildModules in the panel layout): media/settings/content all
// live under the "Website" module there, so they aggregate the same way
// here. The client sends its raw pathname; only a value derived HERE is
// ever stored — an admin scripting fake paths can at worst mislabel their
// own minutes, never inject arbitrary strings into the report.
export function moduleFromPath(path: string): string {
  const rest = path.startsWith("/admin") ? path.slice("/admin".length) : null;
  if (rest === null) return "other";
  if (rest === "" || rest === "/") return "dashboard";
  if (rest.startsWith("/crm")) return "crm";
  if (rest.startsWith("/content") || rest.startsWith("/media") || rest.startsWith("/settings")) return "website";
  if (rest.startsWith("/developments") || rest.startsWith("/developers") || rest.startsWith("/feeds")) return "developments";
  if (rest.startsWith("/analytics")) return "analytics";
  if (rest.startsWith("/users")) return "users";
  if (rest.startsWith("/account")) return "account";
  return "other";
}

export async function recordAdminActivity(userId: string, module?: string | null): Promise<void> {
  const now = Date.now();
  const last = lastPing.get(userId) ?? 0;
  if (now - last < PING_THROTTLE_MS) return;
  lastPing.set(userId, now);
  try {
    // Re-check isActive: a deactivated user's still-open tab keeps beating
    // until they interact and get bounced — those beats must not count.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user?.isActive) return;
    await prisma.adminActivityPing.create({ data: { userId, module: module ?? null } });
  } catch {
    // Activity logging must never break the admin panel itself.
  }
}
