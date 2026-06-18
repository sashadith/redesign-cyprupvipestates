import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAYS = 30;

type Row = {
  path: string;
  locale: string | null;
  referrer: string | null;
  visitorHash: string | null;
  createdAt: Date;
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AnalyticsPage() {
  const cutoff = new Date(Date.now() - DAYS * 86_400_000);
  const rows = (await prisma.pageView.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { path: true, locale: true, referrer: true, visitorHash: true, createdAt: true },
  })) as Row[];

  const uniq = (rs: Row[]) => new Set(rs.map((r) => r.visitorHash).filter(Boolean)).size;
  const totalViews = rows.length;
  const totalUniques = uniq(rows);

  const today = dayKey(new Date());
  const todayRows = rows.filter((r) => dayKey(r.createdAt) === today);

  // Per-day series for the last 30 days
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  const bucket: Record<string, { views: number; uni: Set<string> }> = {};
  for (const d of days) bucket[d] = { views: 0, uni: new Set() };
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    if (bucket[k]) {
      bucket[k].views++;
      if (r.visitorHash) bucket[k].uni.add(r.visitorHash);
    }
  }
  const series = days.map((d) => ({ day: d, views: bucket[d].views, uniques: bucket[d].uni.size }));
  const maxViews = Math.max(1, ...series.map((s) => s.views));

  const countBy = (key: "path" | "referrer" | "locale") => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = r[key];
      if (!v) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const topPages = countBy("path").slice(0, 12);
  const topReferrers = countBy("referrer").slice(0, 10);
  const byLocale = countBy("locale");

  const Stat = ({ label, value }: { label: string; value: number }) => (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString("en-GB")}</div>
    </div>
  );

  const ListCard = ({ title, rows: list, label }: { title: string; rows: [string, number][]; label: string }) => (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map(([k, n]) => (
            <li key={k} className="flex justify-between gap-3 text-sm">
              <span className="truncate text-[#374151]" title={k}>{k}</span>
              <span className="text-[#6B7280] tabular-nums shrink-0">{n.toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="sr-only">{label}</div>
    </div>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <span className="text-sm text-[#6B7280]">Last {DAYS} days · first-party, cookieless</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Pageviews (30d)" value={totalViews} />
        <Stat label="Unique visitors (30d)" value={totalUniques} />
        <Stat label="Pageviews today" value={todayRows.length} />
        <Stat label="Unique today" value={uniq(todayRows)} />
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Pageviews per day</h2>
        {totalViews === 0 ? (
          <p className="text-sm text-[#6B7280]">No pageviews recorded yet. Data appears as visitors browse the public site.</p>
        ) : (
          <div className="flex items-end gap-[3px] h-40">
            {series.map((s) => (
              <div key={s.day} className="flex-1 flex flex-col justify-end group relative" title={`${s.day}: ${s.views} views · ${s.uniques} unique`}>
                <div className="bg-[#1B4B43] rounded-t" style={{ height: `${Math.round((s.views / maxViews) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-2">
          <span>{series[0]?.day}</span>
          <span>{series[series.length - 1]?.day}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <ListCard title="Top pages" rows={topPages} label="path → views" />
        <ListCard title="Top referrers" rows={topReferrers} label="referrer → views" />
      </div>

      <div className="max-w-md">
        <ListCard title="By language" rows={byLocale} label="locale → views" />
      </div>
    </div>
  );
}
