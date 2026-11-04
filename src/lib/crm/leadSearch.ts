import type { Prisma } from "@prisma/client";

// Pure parts of the ⌘K lead search. The action (src/app/crm/actions.ts) adds the access
// scope and the raw-SQL digit match, as src/lib/mcp/tools/searchLeads.ts does.

const digitsOf = (s: string) => s.replace(/\D/g, "");

export function leadSearchParts(raw: string): { text: Prisma.LeadWhereInput; digits: string | null } | null {
  const q = raw.trim();
  if (q.length < 2) return null;
  const digits = digitsOf(q);
  return {
    text: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    digits: digits.length >= 5 ? digits : null,
  };
}

// isOwner: the owner-only design page (/crm/settings/design) is listed for the owner alone.
export function paletteActions(canAssign: boolean, oldCrm: boolean, isOwner = false): { id: string; label: string; href: string }[] {
  return [
    { id: "today", label: "Today", href: "/crm/today" },
    { id: "pipeline", label: "Pipeline", href: "/crm/pipeline" },
    ...(canAssign
      ? [
          { id: "inbox", label: "Inbox", href: "/crm/inbox" },
          { id: "team", label: "Team", href: "/crm/team" },
          { id: "commissions", label: "Commissions", href: "/crm/commissions" },
          { id: "insights", label: "Insights", href: "/crm/insights" },
          { id: "trash", label: "Trash", href: "/crm/trash" },
        ]
      : []),
    { id: "new-lead", label: "New lead", href: "/crm/leads/new" },
    ...(isOwner ? [{ id: "design", label: "Design", href: "/crm/settings/design" }] : []),
    ...(oldCrm ? [{ id: "old-crm", label: "Old CRM", href: "/admin/crm" }] : []),
  ];
}
