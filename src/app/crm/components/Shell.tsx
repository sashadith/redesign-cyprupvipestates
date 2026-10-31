"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ThemeOption } from "@/lib/design/options";
import { ThemePicker } from "./ThemePicker";
import { CommandPalette, type PaletteHandle } from "./CommandPalette";
import { LogoFull, LogoMark } from "@/app/partner-portal/components/Brand";

// oldCrm: the person may use /admin/crm (src/lib/crm/oldCrmGate.ts). Without it the
// link into the old CRM ("Old CRM") would only bounce back here.
// isOwner: the design page (/crm/settings/design) is owner only; nobody else sees its entry.
// themes: the sets offered to staff + this user's stored choice (null = default); empty offered list hides the picker.
// nag: the user's overdue / due-today leads (lead reminders, 2026-10-31) — a red bar over every CRM page and the
// count in the tab title, refreshed every NAG_POLL_MS so a tab left open keeps nagging.
type NagCounts = { overdue: number; now: number };
type Props = { user: { name: string; canAssign: boolean; inboxCount: number; oldCrm: boolean; isOwner: boolean }; themes?: { options: ThemeOption[]; choiceId: string | null }; nag?: NagCounts; children: React.ReactNode };

const NAG_POLL_MS = 5 * 60_000;
const BASE_TITLE = "CVE Office";

function useNagCounts(initial: NagCounts): NagCounts {
  const [nag, setNag] = useState(initial);
  useEffect(() => setNag(initial), [initial.overdue, initial.now]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/crm/nag-count", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as Partial<NagCounts>;
        if (alive && typeof j.overdue === "number" && typeof j.now === "number") setNag({ overdue: j.overdue, now: j.now });
      } catch {
        // Offline or logged out: keep the last counts.
      }
    };
    const timer = setInterval(load, NAG_POLL_MS);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => {
    const n = nag.overdue + nag.now;
    document.title = n > 0 ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
  }, [nag.overdue, nag.now]);
  return nag;
}

export function Shell({ user, themes = { options: [], choiceId: null }, nag: nagInitial = { overdue: 0, now: 0 }, children }: Props) {
  const nag = useNagCounts(nagInitial);
  const path = usePathname();
  const on = (p: string) => (path === p || path.startsWith(p + "/") ? "on" : undefined);
  const palette = useRef<PaletteHandle>(null);
  const [meOpen, setMeOpen] = useState(false);
  const meRef = useRef<HTMLDivElement>(null);
  const meBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!meOpen) return;
    const onDown = (e: MouseEvent) => { if (!meRef.current?.contains(e.target as Node)) setMeOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMeOpen(false); meBtn.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [meOpen]);
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      <header className="crm-top">
        {/* Gold mark on phones, full wordmark from 721px, "Office" tag from 1101px (crm.css). */}
        <Link href="/crm/today" className="crm-logo" aria-label="CVE Office">
          <LogoMark className="crm-logo-mark" />
          <LogoFull className="crm-logo-full" />
          <span aria-hidden="true">Office</span>
        </Link>
        <nav className="crm-nav" aria-label="CRM">
          <Link href="/crm/today" className={on("/crm/today")}>Today</Link>
          <Link href="/crm/pipeline" className={on("/crm/pipeline")}>Pipeline</Link>
          {user.canAssign && (
            <Link href="/crm/inbox" className={on("/crm/inbox")}>
              Inbox {user.inboxCount > 0 && <span className="n">{user.inboxCount}</span>}
            </Link>
          )}
          {user.canAssign && <Link href="/crm/partners" className={on("/crm/partners")}>Partners</Link>}
          {user.canAssign && <Link href="/crm/team" className={on("/crm/team")}>Team</Link>}
          {user.canAssign && <Link href="/crm/commissions" className={on("/crm/commissions")}>Commissions</Link>}
          {user.canAssign && <Link href="/crm/insights" className={on("/crm/insights")}>Insights</Link>}
          {user.canAssign && <Link href="/crm/trash" className={on("/crm/trash")}>Trash</Link>}
          {user.isOwner && <Link href="/crm/settings/design" className={on("/crm/settings/design")}>Design</Link>}
          {user.oldCrm && <Link href="/admin/crm">Old CRM</Link>}
        </nav>
        <button type="button" className="crm-search-btn" onClick={() => palette.current?.open()} aria-label="Search (Command K)">Search <kbd>⌘K</kbd></button>
        <div className="crm-me" ref={meRef}>
          {/* Every user has a menu since 2026-10-31 (Telegram reminders). */}
          <>
              <button type="button" ref={meBtn} className="crm-me-btn" aria-haspopup="true" aria-expanded={meOpen} aria-label={`${user.name}: settings`} onClick={() => setMeOpen((o) => !o)}>
                <span>{user.name}</span><b aria-hidden="true">{initials}</b>
              </button>
              {meOpen && (
                <div className="crm-me-menu">
                  {themes.options.length > 0 && (
                    <>
                      <p className="crm-me-title">Colour set</p>
                      <ThemePicker options={themes.options} choiceId={themes.choiceId} />
                    </>
                  )}
                  <Link href="/crm/settings/telegram" className="crm-me-link" onClick={() => setMeOpen(false)}>Telegram reminders →</Link>
                  {user.isOwner && <Link href="/crm/settings/design" className="crm-me-link" onClick={() => setMeOpen(false)}>Design settings →</Link>}
                </div>
              )}
          </>
        </div>
      </header>
      <CommandPalette ref={palette} canAssign={user.canAssign} oldCrm={user.oldCrm} isOwner={user.isOwner} />
      <main className="crm-main">
        {nag.overdue + nag.now > 0 && path !== "/crm/settings/telegram" && (
          <div className={`crm-nagbar${nag.overdue ? "" : " now"}`} role="status">
            <span>
              {nag.overdue > 0 && <>🔴 {nag.overdue} {nag.overdue === 1 ? "lead" : "leads"} overdue</>}
              {nag.overdue > 0 && nag.now > 0 && " · "}
              {nag.now > 0 && <>🟡 {nag.now} due today</>}
            </span>
            <Link href="/crm/pipeline?filter=due">Show them →</Link>
          </div>
        )}
        {children}
      </main>
      <nav className="crm-dock" aria-label="Quick actions">
        {/* Quick actions only: Today, Team and Commissions are in the top nav and ⌘K. */}
        <Link href="/crm/leads/new" className="plus">＋ New lead</Link>
        <Link href="/crm/pipeline">Pipeline</Link>
        {user.canAssign && <Link href="/crm/inbox">Inbox</Link>}
      </nav>
    </>
  );
}
