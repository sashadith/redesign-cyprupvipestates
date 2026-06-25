"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export type NavPage = { href: string; label: string };
// A module is one application section. Single-page modules (Dashboard, Analytics)
// link straight to their page; multi-page modules open a secondary sidebar.
export type NavModule = { key: string; label: string; pages: NavPage[] };

type Props = {
  modules: NavModule[];
  user: { email?: string | null; role?: string | null };
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

function ModuleIcon({ k }: { k: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (k) {
    case "dashboard":
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>);
    case "crm":
      return (<svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>);
    case "analytics":
      return (<svg {...common}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>);
    case "website":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></svg>);
    case "settings":
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6.2 8.6l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 12 4.6h0a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.18l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 12z" /></svg>);
    case "users":
      return (<svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    default:
      return <span className="block w-5 h-5" />;
  }
}

export default function Sidebar({ modules, user, logoSrc, signOut }: Props) {
  const pathname = usePathname() || "";
  const { activeModuleKey, activePage } = useMemo(() => resolveActive(pathname, modules), [pathname, modules]);
  const activeModule = modules.find((m) => m.key === activeModuleKey);
  const [open, setOpen] = useState(false);

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
        <ModuleIcon k={m.key} />
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
      className={`block rounded-md px-3 py-2 text-sm transition-colors border-l-2 pl-[10px] ${
        p.href === activePage
          ? "bg-[#1B4B43]/10 text-[#1B4B43] font-medium border-[#1B4B43]"
          : "text-[#111827] hover:bg-[#1B4B43]/8 hover:text-[#1B4B43] border-transparent"
      }`}
    >
      {p.label}
    </Link>
  );

  const userFooter = (
    <div className="p-3 border-t border-[#E5E7EB]">
      <div className="px-1 py-1 text-[11px] text-[#6B7280] truncate">{user?.email}</div>
      <div className="px-1 text-[11px] text-[#9CA3AF]">{user?.role}</div>
      <form action={signOut}>
        <button className="mt-1 w-full text-left rounded-md px-2 py-1.5 text-xs text-[#C0392B] hover:bg-[#C0392B]/8">
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
      <aside className="hidden md:flex w-[84px] shrink-0 bg-white border-r border-[#E5E7EB] flex-col h-screen sticky top-0">
        <Link href="/admin" className="flex items-center justify-center px-2 py-3 border-b border-[#E5E7EB]">
          {/* CVE Logo NEU Gold.png — square 1:1, rendered in a fixed square box */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Cyprus VIP Estates" className="w-12 h-12 object-contain" />
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
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">{activeModule.pages.map(pageItem)}</nav>
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
              <img src={logoSrc} alt="Cyprus VIP Estates" className="w-12 h-12 object-contain shrink-0" />
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
                      <ModuleIcon k={m.key} /> {m.label}
                    </Link>
                    {isActive && m.pages.length > 1 && (
                      <div className="ml-3 mt-0.5 border-l border-[#E5E7EB] pl-2 space-y-0.5">
                        {m.pages.map(pageItem)}
                      </div>
                    )}
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
