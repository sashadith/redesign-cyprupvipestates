"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { CommandPalette, type PaletteHandle } from "./CommandPalette";
import { LogoFull, LogoMark } from "@/app/partner-portal/components/Brand";

// oldCrm: the person may use /admin/crm (src/lib/crm/oldCrmGate.ts). Without it the
// link into the old CRM ("Old CRM") would only bounce back here.
type Props = { user: { name: string; canAssign: boolean; inboxCount: number; oldCrm: boolean }; children: React.ReactNode };

export function Shell({ user, children }: Props) {
  const path = usePathname();
  const on = (p: string) => (path === p || path.startsWith(p + "/") ? "on" : undefined);
  const palette = useRef<PaletteHandle>(null);
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
          {user.oldCrm && <Link href="/admin/crm">Old CRM</Link>}
        </nav>
        <button type="button" className="crm-search-btn" onClick={() => palette.current?.open()} aria-label="Search (Command K)">Search <kbd>⌘K</kbd></button>
        <div className="crm-me"><span>{user.name}</span><b aria-hidden="true">{initials}</b></div>
      </header>
      <CommandPalette ref={palette} canAssign={user.canAssign} oldCrm={user.oldCrm} />
      <main className="crm-main">{children}</main>
      <nav className="crm-dock" aria-label="Quick actions">
        {/* Quick actions only: Today, Team and Commissions are in the top nav and ⌘K. */}
        <Link href="/crm/leads/new" className="plus">＋ New lead</Link>
        <Link href="/crm/pipeline">Pipeline</Link>
        {user.canAssign && <Link href="/crm/inbox">Inbox</Link>}
      </nav>
    </>
  );
}
