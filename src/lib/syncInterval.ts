/* When a scheduled developer sync is due (DeveloperAccount.driveSyncInterval).
 *
 * Shared by the Drive, Kuutio (Dropbox), Korantina (SharePoint) and Stylianides
 * syncs. Each used to compare "now - driveSyncedAt < interval" on its own, and
 * that strict test skipped every second run: the cron fires at the same minute
 * each day, but driveSyncedAt is written when the previous run FINISHED, a
 * minute or two later, so the next day's run is always a little short of 24 h.
 * Seen live 2026-10-31: Olias Homes (daily) synced 10-30 04:32:11 UTC and was
 * skipped at 10-31 04:30; Motive Point (weekly, 10-23 04:30:27) missed 10-30 by
 * 27 s and ran after 8 days. A run is therefore due SYNC_GRACE_MS early. */

export const SYNC_GRACE_MS = 2 * 3600e3;

export const intervalMs = (i: string | null | undefined) =>
  i === "off" ? Infinity : i === "weekly" ? 7 * 864e5 : i === "2day" ? 2 * 864e5 : 864e5;

/** True when a scheduled run should be skipped: the interval is off, or the last
 *  sync is more recent than the interval minus the grace. Never synced = due. */
export function notDueYet(interval: string | null | undefined, lastSyncedAt: Date | string | null | undefined, now = Date.now()): boolean {
  const iv = intervalMs(interval);
  if (iv === Infinity) return true;
  if (lastSyncedAt == null) return false;
  return now - new Date(lastSyncedAt).getTime() < iv - SYNC_GRACE_MS;
}
