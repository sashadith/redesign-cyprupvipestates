import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminDateTime, adminClockTime, adminDateKey, CYPRUS_TZ } from "@/lib/adminTime";
import { cyprusWallTimeToUtc } from "@/lib/booking/timezone";
import { getAdminActivityReport, formatDuration } from "@/lib/adminActivityReport";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60_000;

function parseDateParam(v: string | string[] | undefined, fallback: Date): Date {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const [y, m, d] = s.split("-").map(Number);
  return cyprusWallTimeToUtc(y, m, d, 0, 0);
}

/** "Mon, 24 Aug" from a Cyprus date key. Noon UTC keeps the calendar day stable in any zone. */
function dayLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: CYPRUS_TZ, weekday: "short", day: "2-digit", month: "short",
  });
}

export default async function AdminActivityPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  // Working-hours data on colleagues — restricted to the owner account only,
  // not every ADMIN-role user (Users page/list is role-gated; this is
  // narrower on purpose, per Sascha's explicit request 2026-08-24).
  const viewer = uid ? await prisma.user.findUnique({ where: { id: uid }, select: { isOwner: true } }) : null;
  if (!viewer?.isOwner) redirect("/admin");

  const todayCyprus = adminDateKey(new Date());
  const [ty, tm, td] = todayCyprus.split("-").map(Number);
  const defaultTo = cyprusWallTimeToUtc(ty, tm, td, 0, 0); // start of today, Cyprus time
  const defaultFrom = new Date(defaultTo.getTime() - 6 * DAY_MS); // 7-day window inclusive of today

  const from = parseDateParam(searchParams.from, defaultFrom);
  const toStart = parseDateParam(searchParams.to, defaultTo);
  const to = new Date(toStart.getTime() + DAY_MS); // query is exclusive-upper, so include the whole "to" day

  const fromInput = adminDateKey(from);
  const toInput = adminDateKey(toStart);

  const { users, daily } = await getAdminActivityReport(from, to);
  const grandTotalMs = users.reduce((sum, r) => sum + r.totalMs, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Admin Activity</h1>
        <form method="GET" className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-[#6B7280]">
            From
            <input type="date" name="from" defaultValue={fromInput} className="h-9 rounded-md border border-[#E5E7EB] px-2 text-sm" />
          </label>
          <label className="flex items-center gap-1.5 text-[#6B7280]">
            To
            <input type="date" name="to" defaultValue={toInput} className="h-9 rounded-md border border-[#E5E7EB] px-2 text-sm" />
          </label>
          <button type="submit" className="h-9 rounded-md bg-[#1B4B43] text-white px-3 text-sm font-medium">Apply</button>
        </form>
      </div>

      <p className="text-sm text-[#6B7280]">
        {adminDateTime(from)} – {adminDateTime(new Date(to.getTime() - 1))} (Cyprus time) · combined active time across all users: <span className="font-medium text-[#111827]">{formatDuration(grandTotalMs)}</span>
      </p>

      <p className="text-xs text-[#9CA3AF] max-w-2xl">
        Measures genuine activity: the browser only reports presence while the admin tab is visible and the user
        produced real input (mouse, keyboard, scrolling) within the last 3 minutes — an open-but-idle tab stops
        counting after at most 3 minutes, and a session ends once activity stops for a few minutes. Accurate to
        within a couple of minutes per session; not a legal-grade timesheet.
      </p>

      {/* ── Daily overview ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F8F9FA] font-medium">Daily overview</div>
        {daily.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#9CA3AF]">No activity in this range.</p>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-[#6B7280]">
              <tr>
                <th className="text-left font-medium px-4 py-2">Day</th>
                <th className="text-left font-medium px-4 py-2">User</th>
                <th className="text-left font-medium px-4 py-2">First</th>
                <th className="text-left font-medium px-4 py-2">Last</th>
                <th className="text-left font-medium px-4 py-2">Active</th>
                <th className="text-left font-medium px-4 py-2">Sessions</th>
                <th className="text-left font-medium px-4 py-2">Worked on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {daily.map((row, i) => {
                const firstOfDay = i === 0 || daily[i - 1].dateKey !== row.dateKey;
                return (
                  <tr key={`${row.dateKey}-${row.userId}`} className={firstOfDay && i > 0 ? "border-t-2 border-t-[#D1D5DB]" : undefined}>
                    <td className="px-4 py-2 whitespace-nowrap">{firstOfDay ? dayLabel(row.dateKey) : ""}</td>
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2 tabular-nums">{adminClockTime(row.first)}</td>
                    <td className="px-4 py-2 tabular-nums">{adminClockTime(row.last)}</td>
                    <td className="px-4 py-2 font-medium tabular-nums">{formatDuration(row.totalMs)}</td>
                    <td className="px-4 py-2 tabular-nums">{row.sessionCount}</td>
                    <td className="px-4 py-2 text-[#6B7280]">
                      {row.moduleMinutes.length === 0
                        ? "—"
                        : row.moduleMinutes.map((m) => `${m.label} ${formatDuration(m.minutes * 60_000)}`).join(" · ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Per-user session detail ────────────────────────────────────── */}
      <div className="space-y-4">
        {users.map((r) => (
          <div key={r.userId} className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="text-[#6B7280] text-sm ml-2">{r.email}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] ml-2">{r.role}</span>
              </div>
              <span className="text-sm font-medium">{formatDuration(r.totalMs)}</span>
            </div>
            {r.sessions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#9CA3AF]">No activity in this range.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[#6B7280]">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Start</th>
                    <th className="text-left font-medium px-4 py-2">End</th>
                    <th className="text-left font-medium px-4 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {r.sessions.map((s, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{adminDateTime(s.start)}</td>
                      <td className="px-4 py-2">{adminDateTime(s.end)}</td>
                      <td className="px-4 py-2">{formatDuration(s.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
