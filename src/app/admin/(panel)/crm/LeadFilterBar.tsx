"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 2026-08-11 — fixed height instead of vertical padding: <input> and
// <select> render at slightly different heights for the same py-* value
// (native OS rendering of <select>'s box differs from <input>'s), which is
// what made the row's heights visibly jump. An explicit h-9 makes every
// control identical regardless of element type.
const sel = "h-9 rounded-md border border-[#E5E7EB] px-2.5 text-sm bg-white";
const SEARCH_DEBOUNCE_MS = 300;

// Live search/filter (Batch A, 2026-07-25) — replaces the old GET <form> +
// "Apply" button. Dropdowns push their new value straight into the URL (soft
// navigation, no full reload); the text search debounces so typing doesn't
// fire a request per keystroke. `router.replace` (not `push`) so filtering
// around doesn't pile up back-button history, and `scroll: false` so the
// list doesn't jump to the top on every change.
export default function LeadFilterBar({
  statuses, sources, locales, users,
}: {
  statuses: string[]; sources: string[]; locales: string[]; users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);

  // Keep the input in sync with the URL when it changes from elsewhere
  // (Reset button, browser back/forward) rather than from this input itself.
  useEffect(() => {
    setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    params.delete("page"); // any filter change re-starts pagination at page 1
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    if (q === urlQ) return;
    const t = setTimeout(() => updateParams({ q }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const val = (key: string) => searchParams.get(key) ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 bg-white border border-[#E5E7EB] rounded-lg p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name / email / phone"
        className={`${sel} min-w-[220px]`}
      />
      <select value={val("status")} onChange={(e) => updateParams({ status: e.target.value })} className={sel}>
        <option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>
      <select value={val("source")} onChange={(e) => updateParams({ source: e.target.value })} className={sel}>
        <option value="">All sources</option>{sources.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>
      <select value={val("lang")} onChange={(e) => updateParams({ lang: e.target.value })} className={sel}>
        <option value="">All langs</option>{locales.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
      </select>
      <select value={val("assignee")} onChange={(e) => updateParams({ assignee: e.target.value })} className={sel}>
        <option value="">Any assignee</option><option value="unassigned">Unassigned</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select value={val("sort")} onChange={(e) => updateParams({ sort: e.target.value })} className={sel}>
        <option value="">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option>
        <option value="name">Name A–Z</option>
      </select>
      <button
        type="button"
        onClick={() => { setQ(""); router.replace(pathname, { scroll: false }); }}
        className="h-9 rounded-md border border-[#E5E7EB] px-3 text-sm text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]"
      >
        Reset
      </button>
    </div>
  );
}
