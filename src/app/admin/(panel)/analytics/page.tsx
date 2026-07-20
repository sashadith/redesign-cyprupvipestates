import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { detectDeviceType } from "@/lib/deviceType";
import { countryName } from "@/lib/geoCountry";
import CountriesCard, { type CountryRow } from "./CountriesCard";

export const dynamic = "force-dynamic";

type RangeKey = "today" | "7d" | "14d" | "30d" | "90d" | "1y" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "14d", label: "14 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All time" },
];
const RANGE_DAYS: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90, "1y": 365 };

function parseRange(v: string | undefined): RangeKey {
  return RANGE_OPTIONS.some((o) => o.key === v) ? (v as RangeKey) : "30d";
}

function rangeCutoff(range: RangeKey): Date | null {
  if (range === "all") return null;
  if (range === "today") {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  return new Date(Date.now() - RANGE_DAYS[range] * 86_400_000);
}

type Row = {
  path: string;
  locale: string | null;
  referrer: string | null;
  visitorHash: string | null;
  userAgent: string | null;
  deviceType: string | null;
  country: string | null;
  createdAt: Date;
};

const DEVICE_LABEL: Record<string, string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = parseRange(searchParams.range);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)!.label;
  const cutoff = rangeCutoff(range);

  // isBot/isPrefetch/isTest rows are recorded (not silently dropped at ingestion —
  // see src/app/api/analytics/track/route.ts) so they can be counted below, but
  // excluded from every real card/chart on this page.
  const NOT_EXCLUDED = { isBot: false, isPrefetch: false, isTest: false } as const;

  const rows = (await prisma.pageView.findMany({
    where: cutoff ? { createdAt: { gte: cutoff }, ...NOT_EXCLUDED } : NOT_EXCLUDED,
    select: { path: true, locale: true, referrer: true, visitorHash: true, userAgent: true, deviceType: true, country: true, createdAt: true },
  })) as Row[];

  // Country was only ever derived at track time (never backfillable — the IP
  // itself was never stored), so note the coverage start for the card below.
  const earliestCountryRow = await prisma.pageView.findFirst({
    where: { country: { not: null }, ...NOT_EXCLUDED },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  // "Bot traffic" sanity-check line (footer) — counts, not filtered rows, so this
  // stays cheap even on "All time". Todays's midnight boundary matches `todayKey`
  // below (UTC day).
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [botToday, prefetchToday, testToday] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: todayStart }, isBot: true } }),
    prisma.pageView.count({ where: { createdAt: { gte: todayStart }, isPrefetch: true } }),
    prisma.pageView.count({ where: { createdAt: { gte: todayStart }, isTest: true } }),
  ]);
  const excludedToday = botToday + prefetchToday + testToday;

  const uniq = (rs: Row[]) => new Set(rs.map((r) => r.visitorHash).filter(Boolean)).size;
  const totalViews = rows.length;
  const totalUniques = uniq(rows);

  const todayKey = dayKey(new Date());
  const todayRows = rows.filter((r) => dayKey(r.createdAt) === todayKey);

  // Per-bucket series: hourly for "today", daily otherwise.
  let series: { day: string; views: number; uniques: number }[];
  if (range === "today") {
    const nowHour = new Date().getUTCHours();
    const hours = Array.from({ length: nowHour + 1 }, (_, i) => i);
    const bucket: Record<number, { views: number; uni: Set<string> }> = {};
    for (const h of hours) bucket[h] = { views: 0, uni: new Set() };
    for (const r of rows) {
      const h = r.createdAt.getUTCHours();
      if (bucket[h]) {
        bucket[h].views++;
        if (r.visitorHash) bucket[h].uni.add(r.visitorHash);
      }
    }
    series = hours.map((h) => ({ day: `${String(h).padStart(2, "0")}:00`, views: bucket[h].views, uniques: bucket[h].uni.size }));
  } else {
    const startDay = range === "all"
      ? rows.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), rows[0]?.createdAt ?? new Date())
      : cutoff!;
    const dayCount = Math.max(1, Math.ceil((Date.now() - startDay.getTime()) / 86_400_000) + 1);
    const days: string[] = [];
    for (let i = dayCount - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86_400_000)));
    const bucket: Record<string, { views: number; uni: Set<string> }> = {};
    for (const d of days) bucket[d] = { views: 0, uni: new Set() };
    for (const r of rows) {
      const k = dayKey(r.createdAt);
      if (bucket[k]) {
        bucket[k].views++;
        if (r.visitorHash) bucket[k].uni.add(r.visitorHash);
      }
    }
    series = days.map((d) => ({ day: d, views: bucket[d].views, uniques: bucket[d].uni.size }));
  }
  const maxViews = Math.max(1, ...series.map((s) => s.views));

  const countBy = (key: "path" | "referrer" | "locale" | "country") => {
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

  // deviceType is stored at track time; older rows fall back to parsing their
  // already-stored userAgent, so device stats cover full history (unlike
  // country, whose source IP was never persisted).
  const deviceCounts = new Map<string, number>();
  for (const r of rows) {
    const d = r.deviceType || detectDeviceType(r.userAgent);
    deviceCounts.set(d, (deviceCounts.get(d) ?? 0) + 1);
  }
  const byDevice = Array.from(deviceCounts.entries()).sort((a, b) => b[1] - a[1]);
  // Resolved to plain data (code/label/count) here, server-side — a function
  // like countryName can't cross into the client CountriesCard as a prop
  // (React Server Components can only pass serializable values to Client
  // Components; this crashed the whole page on every range before).
  const topCountries: CountryRow[] = countBy("country")
    .slice(0, 16)
    .map(([code, count]) => ({ code, label: countryName(code), count }));
  const knownCountryViews = rows.filter((r) => r.country).length;
  const countryNote = earliestCountryRow
    ? `Country data collected since ${earliestCountryRow.createdAt.toISOString().slice(0, 10)}.`
    : "Country data not yet available.";

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

  const BarListCard = ({
    title, rows: list, total, labelFor, note,
  }: {
    title: string;
    rows: [string, number][];
    total: number;
    labelFor?: (key: string) => string;
    note?: string;
  }) => (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map(([k, n]) => {
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <li key={k}>
                <div className="flex justify-between gap-3 text-sm mb-1">
                  <span className="text-[#374151]">{labelFor ? labelFor(k) : k}</span>
                  <span className="text-[#6B7280] tabular-nums shrink-0">{n.toLocaleString("en-GB")} · {pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-[#1B4B43] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="text-xs text-[#9CA3AF] mt-3">{note}</p>}
    </div>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <span className="text-sm text-[#6B7280]">First-party, cookieless</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 bg-white border border-[#E5E7EB] rounded-lg p-1 w-fit">
        {RANGE_OPTIONS.map((o) => (
          <Link
            key={o.key}
            href={o.key === "30d" ? "/admin/analytics" : `/admin/analytics?range=${o.key}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              o.key === range ? "bg-[#1B4B43] text-white font-medium" : "text-[#374151] hover:bg-[#F3F4F6]"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label={`Pageviews (${rangeLabel})`} value={totalViews} />
        <Stat label={`Unique visitors (${rangeLabel})`} value={totalUniques} />
        <Stat label="Pageviews today" value={todayRows.length} />
        <Stat label="Unique today" value={uniq(todayRows)} />
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">{range === "today" ? "Pageviews per hour" : "Pageviews per day"}</h2>
        {totalViews === 0 ? (
          <p className="text-sm text-[#6B7280]">No pageviews recorded yet. Data appears as visitors browse the public site.</p>
        ) : (
          <div className="flex gap-[3px] h-40">
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

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <ListCard title="Top pages" rows={topPages} label="path → views" />
          <CountriesCard rows={topCountries} total={knownCountryViews} note={countryNote} />
        </div>
        <div className="flex flex-col gap-6">
          <ListCard title="Top referrers" rows={topReferrers} label="referrer → views" />
          <ListCard title="By language" rows={byLocale} label="locale → views" />
          <BarListCard title="By device" rows={byDevice} total={totalViews} labelFor={(k) => DEVICE_LABEL[k] ?? k} />
        </div>
      </div>

      <p className="text-xs text-[#9CA3AF] mt-6">
        {excludedToday > 0
          ? `${excludedToday.toLocaleString("en-GB")} bot/prefetch views excluded today (${botToday} bot · ${prefetchToday} prefetch · ${testToday} test) — not counted above.`
          : "No bot/prefetch views excluded today."}
      </p>
    </div>
  );
}
