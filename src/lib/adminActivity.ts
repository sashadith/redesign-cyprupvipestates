import { prisma } from "@/lib/prisma";

// Working-hours activity tracking (2026-08-24). PanelLayout calls
// recordAdminActivity() on every admin panel request; this throttles that
// down to one DB write per user per PING_THROTTLE_MS so a page full of
// navigation doesn't hammer the table. See the AdminActivityPing model in
// schema.prisma for why this is heartbeats, not an explicit login/logout log.
//
// The in-memory throttle map is per Node process. PM2 normally runs this app
// as a single instance, so this map is authoritative; if that ever changes to
// a cluster, the only effect is a few extra rows right at the throttle
// boundary — the report's session clustering absorbs that fine.
const PING_THROTTLE_MS = 3 * 60_000;
const lastPing = new Map<string, number>();

export async function recordAdminActivity(userId: string): Promise<void> {
  const now = Date.now();
  const last = lastPing.get(userId) ?? 0;
  if (now - last < PING_THROTTLE_MS) return;
  lastPing.set(userId, now);
  try {
    await prisma.adminActivityPing.create({ data: { userId } });
  } catch {
    // Activity logging must never break the admin panel itself.
  }
}
