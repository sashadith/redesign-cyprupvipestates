// Shared icon set for the admin nav rail (Sidebar.tsx) and anywhere else that
// needs to echo the same module iconography for visual consistency (e.g. the
// Action Center's category headers).
export function NavIcon({ k, size = 20 }: { k: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (k) {
    case "dashboard":
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>);
    case "crm":
      return (<svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>);
    case "analytics":
      return (<svg {...common}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>);
    case "website":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></svg>);
    case "developments":
      return (<svg {...common}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" /><path d="M10 21v-4h4v4" /></svg>);
    case "settings":
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6.2 8.6l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 12 4.6h0a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.18l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 12z" /></svg>);
    case "users":
      return (<svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case "feeds":
      return (<svg {...common}><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>);
    default:
      return <span className="block" style={{ width: size, height: size }} />;
  }
}

/* Page-level icons for the collapsed secondary sidebar.
 *
 * NavIcon above is per MODULE — the rail only ever needs eight. A collapsed
 * secondary column needs one per PAGE, and pages are declared in layout.tsx
 * without an icon field. Rather than plumb one through every module, this maps
 * by href: the nav is small and static, and a page that is not in the map still
 * gets something meaningful (its initial) instead of an empty square.
 *
 * Matching is longest-prefix, so /admin/analytics/seo/power wins over
 * /admin/analytics. */
const PAGE_ICON_PATHS: Array<[string, React.ReactNode]> = [
  ["/admin/crm/newsletter", <><path d="M4 4h16v16H4z" /><path d="m4 7 8 6 8-6" /></>],
  ["/admin/crm/calendar", <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>],
  ["/admin/crm/board", <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /></>],
  ["/admin/crm/trash", <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" /></>],
  ["/admin/crm", <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>],
  ["/admin/analytics/seo/advisor", <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>],
  ["/admin/analytics/seo/power", <><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>],
  ["/admin/analytics/seo", <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>],
  ["/admin/analytics", <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>],
  ["/admin/users/activity", <><path d="M3 12h4l3-8 4 16 3-8h4" /></>],
  ["/admin/users", <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>],
];

export function PageIcon({ href, label, size = 18 }: { href: string; label: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const hit = PAGE_ICON_PATHS.find(([prefix]) => href === prefix || href.startsWith(prefix + "/")) ?? PAGE_ICON_PATHS.find(([prefix]) => href === prefix);
  if (hit) return <svg {...common}>{hit[1]}</svg>;
  // Fallback: the page's initial, so an unmapped page is still identifiable.
  return (
    <span
      className="inline-flex items-center justify-center rounded-[4px] border border-current text-[10px] font-semibold leading-none"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {label.trim().charAt(0).toUpperCase()}
    </span>
  );
}
