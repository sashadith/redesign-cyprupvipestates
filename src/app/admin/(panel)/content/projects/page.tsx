import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { localizedHref } from "@/lib/locale";
import DeactivateControl from "./DeactivateControl";

export const dynamic = "force-dynamic";
const LOCALES = ["en", "de", "pl", "ru"];

// Sortable columns. Anything not in here is ignored rather than passed to
// Prisma, so a hand-edited ?sort= cannot reach the query.
const SORTS: Record<string, (dir: "asc" | "desc") => any[]> = {
  // city and price are nullable, and Postgres sorts NULLs first on DESC —
  // which would open the list with rows that have nothing to show. Push them
  // to the end in both directions instead.
  title: (dir) => [{ title: dir }],
  city: (dir) => [{ city: { sort: dir, nulls: "last" } }, { title: "asc" }],
  price: (dir) => [{ price: { sort: dir, nulls: "last" } }, { title: "asc" }],
  status: (dir) => [{ status: dir }, { title: "asc" }],
};
// The list's own order when nothing is chosen: featured first, then the manual
// listing priority, then alphabetical. Kept as the default because it is the
// order the public site uses.
const DEFAULT_ORDER = [{ isFeatured: "desc" as const }, { listingPriority: "desc" as const }, { title: "asc" as const }];

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "PUBLISHED", label: "Active" },
  { key: "ARCHIVED", label: "Deactivated" },
];

export default async function ProjectsAdmin({
  searchParams,
}: {
  searchParams: { lang?: string; q?: string; status?: string; sort?: string; dir?: string };
}) {
  const lang = LOCALES.includes(searchParams.lang ?? "") ? searchParams.lang! : "en";
  const q = (searchParams.q ?? "").trim();
  const status = STATUS_FILTERS.some((s) => s.key && s.key === searchParams.status) ? searchParams.status! : "";
  const sort = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : "";
  const dir: "asc" | "desc" = searchParams.dir === "desc" ? "desc" : "asc";

  const where = {
    language: lang as any,
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status ? { status: status as any } : {}),
  };
  const [projects, totalForLang] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: sort ? SORTS[sort](dir) : DEFAULT_ORDER,
      take: 300,
      include: { supersededByDevelopment: { select: { slug: true } } },
    }),
    // Shown next to the filtered count, so "51 of 221" reads as a filter
    // rather than as projects having gone missing.
    prisma.project.count({ where: { language: lang as any } }),
  ]);

  // Every control has to carry the others, or clicking a sort would silently
  // drop the search and the status filter.
  const qs = (o: Record<string, string>) => {
    const p = new URLSearchParams({
      lang,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(sort ? { sort, dir } : {}),
    });
    for (const [k, v] of Object.entries(o)) v ? p.set(k, v) : p.delete(k);
    return `/admin/content/projects?${p.toString()}`;
  };
  // Clicking the active column flips direction; a new column starts ascending.
  const sortHref = (col: string) => qs({ sort: col, dir: sort === col && dir === "asc" ? "desc" : "asc" });
  const SortHead = ({ col, label, align = "left" }: { col: string; label: string; align?: "left" | "right" }) => (
    <th className={`text-${align} font-medium px-4 py-2.5`}>
      <Link href={sortHref(col)} className="inline-flex items-center gap-1 hover:text-[#111827]">
        {label}
        <span className={sort === col ? "text-[#1B4B43]" : "text-[#D1D5DB]"}>{sort === col && dir === "desc" ? "\u2193" : "\u2191"}</span>
      </Link>
    </th>
  );

  // ACTIVATE/DEACTIVATE cascades across every locale row of the same real
  // project — batch-fetch sibling locales per translationGroupId so the
  // dialog can name them, without an N+1 query per row.
  const groupIds = Array.from(new Set(projects.map((p) => p.translationGroupId).filter((v): v is string => !!v)));
  const siblings = groupIds.length
    ? await prisma.project.findMany({ where: { translationGroupId: { in: groupIds } }, select: { translationGroupId: true, language: true } })
    : [];
  const localesByGroup = new Map<string, string[]>();
  for (const s of siblings) {
    if (!s.translationGroupId) continue;
    localesByGroup.set(s.translationGroupId, [...(localesByGroup.get(s.translationGroupId) ?? []), s.language]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex gap-2">
          <Link href="/admin/content/projects/overlaps" className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">Development overlaps</Link>
          <Link href="/admin/content/projects/new" className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]">+ New project</Link>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {LOCALES.map((l) => (
            <Link key={l} href={qs({ lang: l })}
              className={`rounded-md px-3 py-1.5 text-sm ${l === lang ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB] text-[#111827]"}`}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <form className="flex-1 max-w-xs">
          {/* Hidden fields, not just the visible input: submitting the search
              otherwise reloads the page with lang/status/sort dropped. */}
          <input type="hidden" name="lang" value={lang} />
          {status && <input type="hidden" name="status" value={status} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {sort && <input type="hidden" name="dir" value={dir} />}
          <input name="q" defaultValue={q} placeholder="Search title…" className="w-full rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" />
        </form>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Link key={f.key || "all"} href={qs({ status: f.key })}
              className={`rounded-full px-3 py-1 text-sm border ${f.key === status ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
              {f.label}
            </Link>
          ))}
        </div>
        <span className="text-sm text-[#6B7280] whitespace-nowrap">
          {projects.length}{(status || q) && projects.length !== totalForLang ? ` of ${totalForLang}` : ""} shown
        </span>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <SortHead col="title" label="Title" />
              <SortHead col="city" label="City" />
              <SortHead col="price" label="Price" />
              <SortHead col="status" label="Status" />
              <th className="text-left font-medium px-4 py-2.5">Flags</th>
              <th className="text-left font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/projects/${p.id}`} className="text-[#1B4B43] font-medium hover:underline">{p.title}</Link>
                  <div className="text-xs text-[#6B7280]">/{p.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.city ?? "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.price ? `€${p.price.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.status}</td>
                <td className="px-4 py-2.5 text-xs text-[#6B7280]">{p.isFeatured ? "★ featured " : ""}{p.isSold ? "· sold" : ""}</td>
                <td className="px-4 py-2.5">
                  <DeactivateControl
                    projectId={p.id}
                    status={p.status}
                    hasConfirmedLink={!!p.supersededByDevelopment}
                    prefillTarget={p.supersededByDevelopment ? localizedHref(p.language, ["projects", p.supersededByDevelopment.slug ?? ""]) : null}
                    locales={p.translationGroupId ? (localesByGroup.get(p.translationGroupId) ?? [p.language]) : [p.language]}
                    variant="compact"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
