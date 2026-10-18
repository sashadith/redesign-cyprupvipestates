"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// oldCrm: the person may use /admin/crm (src/lib/crm/oldCrmGate.ts). Without it the
// link into the old CRM ("Old CRM") would only bounce back here.
type Props = { user: { name: string; canAssign: boolean; inboxCount: number; oldCrm: boolean }; children: React.ReactNode };

export function Shell({ user, children }: Props) {
  const path = usePathname();
  const on = (p: string) => (path === p || path.startsWith(p + "/") ? "on" : undefined);
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      <header className="crm-top">
        <Link href="/crm/today" className="crm-logo"><i>CV</i>CVE Office</Link>
        <nav className="crm-nav" aria-label="CRM">
          <Link href="/crm/today" className={on("/crm/today")}>Today</Link>
          <Link href="/crm/pipeline" className={on("/crm/pipeline")}>Pipeline</Link>
          {user.canAssign && (
            <Link href="/crm/inbox" className={on("/crm/inbox")}>
              Inbox {user.inboxCount > 0 && <span className="n">{user.inboxCount}</span>}
            </Link>
          )}
          {user.canAssign && <Link href="/crm/team" className={on("/crm/team")}>Team</Link>}
          {user.canAssign && <Link href="/crm/commissions" className={on("/crm/commissions")}>Commissions</Link>}
          {user.oldCrm && <Link href="/admin/crm">Old CRM</Link>}
        </nav>
        <div className="crm-me"><span>{user.name}</span><b aria-hidden="true">{initials}</b></div>
      </header>
      <main className="crm-main">{children}</main>
      <nav className="crm-dock" aria-label="Quick actions">
        <Link href="/crm/leads/new" className="plus">＋ New lead</Link>
        <Link href="/crm/today">Today</Link>
        <Link href="/crm/pipeline">Pipeline</Link>
        {user.canAssign && <Link href="/crm/inbox">Inbox</Link>}
        {user.canAssign && <Link href="/crm/team">Team</Link>}
        {user.canAssign && <Link href="/crm/commissions">Commissions</Link>}
      </nav>
    </>
  );
}
