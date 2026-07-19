"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { NavIcon } from "./NavIcons";

export type NavPage = { href: string; label: string; count?: number; countVariant?: "alert" | "neutral" };
// A module is one application section. Single-page modules (Dashboard, Analytics)
// link straight to their page; multi-page modules open a secondary sidebar.
export type NavModule = { key: string; label: string; pages: NavPage[] };

export type DeveloperNavItem = { id: string; name: string; count: number; hasFeed: boolean };

export type DevTotals = { developers: number; developments: number; units: number };

type Props = {
  modules: NavModule[];
  developersNav?: DeveloperNavItem[];
  devTotals?: DevTotals;
  user: { email?: string | null; role?: string | null; name?: string | null; avatar?: string | null };
  logoSrc: string;
  signOut: () => void | Promise<void>;
};

// How specifically `href` matches `pathname` (longer = more specific). -1 = no match.
function matchLen(pathname: string, href: string): number {
  if (href === "/admin") return pathname === "/admin" ? href.length : -1;
  return pathname === href || pathname.startsWith(href + "/") ? href.length : -1;
}

function resolveActive(pathname: string, modules: NavModule[]) {
  let best = -1;
  let activeModuleKey = modules[0]?.key ?? "";
  let activePage = "";
  for (const m of modules) {
    for (const p of m.pages) {
      const l = matchLen(pathname, p.href);
      if (l > best) {
        best = l;
        activeModuleKey = m.key;
        activePage = p.href;
      }
    }
  }
  return { activeModuleKey, activePage };
}

// First page of a module = its landing target when clicked in the rail.
const landing = (m: NavModule) => m.pages[0]?.href ?? "/admin";

// Developer-grouped secondary nav for the Developments module, with a live search
// filter. Top-level (stable identity) so the search text survives re-renders.
function FeedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#D97757]" aria-label="has feed">
      <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function DevelopmentsNavPanel({ nav, totals, pathname, onNavigate }: { nav: DeveloperNavItem[]; totals?: DevTotals; pathname: string; onNavigate: () => void }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const list = ql ? nav.filter((d) => d.name.toLowerCase().includes(ql)) : nav;

  const simple = (href: string, label: string, active: boolean) => (
    <Link href={href} onClick={onNavigate}
      className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-[#1B4B43]/10 text-[#1B4B43] font-medium" : "text-[#111827] hover:bg-[#1B4B43]/8 hover:text-[#1B4B43]"}`}>{label}</Link>
  );
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
      <div className="px-1 pb-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search developers…"
          className="w-full rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm outline-none focus:border-[#1B4B43]" />
      </div>
      {list.length ? list.map((d) => {
        const href = `/admin/developments/developers/${d.id}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={d.id} href={href} onClick={onNavigate}
            className={`flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${active ? "bg-[#1B4B43]/10 text-[#1B4B43] font-medium" : "text-[#111827] hover:bg-[#1B4B43]/8 hover:text-[#1B4B43]"}`}>
            <span className="flex items-center gap-1.5 truncate">
              <span className="truncate">{d.name}</span>
              {d.hasFeed && <FeedIcon />}
            </span>
            {d.count > 0 && <span className="shrink-0 text-[11px] text-[#9CA3AF]">{d.count}</span>}
          </Link>
        );
      }) : <p className="px-3 py-1 text-xs text-[#9CA3AF]">{ql ? "No match." : "None yet."}</p>}
      {totals && (
        <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 mt-1 mb-1 space-y-1">
          {([["Developers", totals.developers], ["Developments", totals.developments], ["Units", totals.units]] as const).map(([label, n]) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">{label}</span>
              <span className="text-[#9CA3AF]">{n.toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
      )}
      <Link href="/admin/developments/developers/new" onClick={onNavigate}
        className="block rounded-md border border-dashed border-[#D1D5DB] px-3 py-1.5 mt-1 text-sm text-center text-[#6B7280] hover:border-[#1B4B43] hover:text-[#1B4B43]">
        + Add new developer
      </Link>
      <div className="pt-2 mt-2 border-t border-[#E5E7EB] space-y-0.5">
        {simple("/admin/developments", "All developments", pathname === "/admin/developments")}
        {simple("/admin/developments/areas", "Area descriptions", pathname.startsWith("/admin/developments/areas"))}
      </div>
    </nav>
  );
}

export default function Sidebar({ modules, developersNav, devTotals, user, logoSrc, signOut }: Props) {
  const pathname = usePathname() || "";
  const { activeModuleKey, activePage } = useMemo(() => resolveActive(pathname, modules), [pathname, modules]);
  const activeModule = modules.find((m) => m.key === activeModuleKey);
  const [open, setOpen] = useState(false);
  const devNav = developersNav ?? [];
  const devPanel = <DevelopmentsNavPanel nav={devNav} totals={devTotals} pathname={pathname} onNavigate={() => setOpen(false)} />;

  const railItem = (m: NavModule) => {
    const isActive = m.key === activeModuleKey;
    return (
      <Link
        key={m.key}
        href={landing(m)}
        onClick={() => setOpen(false)}
        aria-current={isActive ? "true" : undefined}
        title={m.label}
        className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[11px] leading-tight transition-colors ${
          isActive ? "bg-[#1B4B43]/10 text-[#1B4B43] font-medium" : "text-[#6B7280] hover:bg-[#1B4B43]/8 hover:text-[#1B4B43]"
        }`}
      >
        <NavIcon k={m.key} />
        <span className="text-center">{m.label}</span>
      </Link>
    );
  };

  const pageItem = (p: NavPage) => (
    <Link
      key={p.href}
      href={p.href}
      onClick={() => setOpen(false)}
      aria-current={p.href === activePage ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors border-l-2 pl-[10px] ${
        p.href === activePage
          ? "bg-[#1B4B43]/10 text-[#1B4B43] font-medium border-[#1B4B43]"
          : "text-[#111827] hover:bg-[#1B4B43]/8 hover:text-[#1B4B43] border-transparent"
      }`}
    >
      <span>{p.label}</span>
      {!!p.count && (
        <span
          className={`rounded-full text-[11px] leading-none font-medium px-1.5 py-1 ${
            p.countVariant === "neutral" ? "bg-[#E5E7EB] text-[#374151]" : "bg-[#DC2626] text-white"
          }`}
        >
          {p.count}
        </span>
      )}
    </Link>
  );

  const displayName = user?.name?.trim() || user?.email || "";
  const initials = (user?.name?.trim() || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  const userFooter = (
    <div className="p-3 border-t border-[#E5E7EB] flex flex-col items-center gap-1.5">
      <Link href="/admin/account" onClick={() => setOpen(false)} className="group flex flex-col items-center gap-1.5 max-w-full cursor-pointer">
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 transition-opacity group-hover:opacity-80" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-[#1B4B43]/10 text-[#1B4B43] text-sm font-semibold flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#1B4B43]/20">
            {initials}
          </span>
        )}
        <span className="text-xs font-medium text-[#111827] truncate max-w-full transition-colors group-hover:text-[#1B4B43]">{displayName}</span>
      </Link>
      {user?.role && (
        <span className="rounded-full bg-[#1B4B43]/10 text-[#1B4B43] text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
          {user.role}
        </span>
      )}
      <form action={signOut} className="w-full">
        <button className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-xs text-[#6B7280] hover:bg-[#C0392B]/8 hover:text-[#C0392B] hover:border-[#C0392B]/30">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-[#E5E7EB] px-4 py-3">
        <Link href="/admin" className="text-sm font-semibold text-[#1B4B43]">Cyprus VIP Estates · Admin</Link>
        <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}
          className="rounded-md border border-[#E5E7EB] p-2 text-[#111827]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Desktop — primary module rail */}
      <aside className="hidden md:flex w-[104px] shrink-0 bg-white border-r border-[#E5E7EB] flex-col h-screen sticky top-0">
        <Link href="/admin" className="flex items-center justify-center px-2 py-3 border-b border-[#E5E7EB]">
          {/* CVE Logo NEU Gold.png — square 1:1, rendered in a fixed square box */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Cyprus VIP Estates" className="w-[58px] h-[58px] object-contain" />
        </Link>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">{modules.map(railItem)}</nav>
        {userFooter}
      </aside>

      {/* Desktop — secondary sidebar (only for multi-page modules) */}
      {activeModule && activeModule.pages.length > 1 && (
        <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-[#E5E7EB] flex-col h-screen sticky top-0">
          <div className="px-4 py-4 border-b border-[#E5E7EB]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{activeModule.label}</div>
          </div>
          {activeModuleKey === "developments"
            ? devPanel
            : <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">{activeModule.pages.map(pageItem)}</nav>}
        </aside>
      )}

      {/* Mobile drawer — modules with the active one expanded inline */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="relative w-72 max-w-[85vw] bg-white border-r border-[#E5E7EB] flex flex-col h-full">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-3">
              {/* CVE Logo NEU Gold.png — square 1:1 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Cyprus VIP Estates" className="w-[58px] h-[58px] object-contain shrink-0" />
              <div>
                <div className="text-sm font-semibold text-[#1B4B43] leading-tight">Cyprus VIP Estates</div>
                <div className="text-xs text-[#6B7280]">Admin</div>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {modules.map((m) => {
                const isActive = m.key === activeModuleKey;
                return (
                  <div key={m.key} className="pt-2 first:pt-0">
                    <Link href={landing(m)} onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        isActive ? "text-[#1B4B43] font-semibold" : "text-[#111827] hover:bg-[#1B4B43]/8"
                      }`}>
                      <NavIcon k={m.key} /> {m.label}
                    </Link>
                    {isActive && (m.key === "developments"
                      ? <div className="mt-0.5">{devPanel}</div>
                      : m.pages.length > 1 && (
                        <div className="ml-3 mt-0.5 border-l border-[#E5E7EB] pl-2 space-y-0.5">
                          {m.pages.map(pageItem)}
                        </div>
                      ))}
                  </div>
                );
              })}
            </nav>
            {userFooter}
          </aside>
        </div>
      )}
    </>
  );
}
