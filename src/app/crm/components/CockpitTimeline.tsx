import type { ReactNode } from "react";
import type { TimelineItem } from "@/lib/crm/timeline";
import { ago } from "@/lib/crm/timeline";
import { adminDateTime } from "@/lib/adminTime";

// Lead cockpit timeline (CRM v2, 2026-10-18). Server-rendered. Inbound email
// and WhatsApp text is written by the lead: shown as plain text (pre-wrap),
// never as HTML.

const ICON: Record<TimelineItem["kind"], ReactNode> = {
  call: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h5" /></>,
  whatsapp: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  status: <path d="M5 12h12M13 6l6 6-6 6" />,
  presentation: <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M12 16v4M8 20h8" /></>,
  booking: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  system: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
};

export function CockpitTimeline({ items, now, truncated, action }: { items: TimelineItem[]; now: Date; truncated: boolean; action?: ReactNode }) {
  return (
    <section className="crm-panel crm-ck-timeline" aria-labelledby="crm-ck-tl-h">
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-tl-h">Timeline</h2>
        {action}
      </div>
      {items.length === 0 ? (
        <p className="crm-muted">Nothing logged yet.</p>
      ) : (
        <ol>
          {items.map((it) => (
            <li key={it.id} className={`k-${it.kind}${it.inbound ? " in" : ""}`}>
              <span className="crm-ck-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON[it.kind]}</svg>
              </span>
              <div className="crm-ck-item">
                <div className="crm-ck-itemhead">
                  <b>{it.title}</b>
                  <span className="crm-muted">
                    <time dateTime={it.at} title={adminDateTime(it.at)}>{ago(it.at, now)}</time>
                    {it.by && <> · {it.by}</>}
                  </span>
                </div>
                {it.text && <p className="crm-ck-text">{it.text}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {truncated && <p className="crm-muted crm-ck-more">Showing the latest 100 entries.</p>}
    </section>
  );
}
