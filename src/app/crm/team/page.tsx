import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { ACTIVE_LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { TeamTable, type TeamRow } from "../components/TeamTable";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  const [users, loads] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, isOwner: true, canSeeColleagues: true, canEditColleagues: true, languages: true, specialties: true, acceptsLeads: true },
    }),
    prisma.lead.groupBy({ by: ["assignedToId"], where: { deletedAt: null, assignedToId: { not: null }, status: { in: [...ACTIVE_LEAD_STATUSES] } }, _count: { _all: true } }),
  ]);
  const loadOf = new Map(loads.map((l) => [l.assignedToId, l._count._all]));
  const rows: TeamRow[] = users.map((u) => ({
    id: u.id, name: u.name, email: u.email, seesEverything: u.isOwner || u.role === "ADMIN",
    canSeeColleagues: u.canSeeColleagues, canEditColleagues: u.canEditColleagues,
    languages: u.languages, specialties: u.specialties, acceptsLeads: u.acceptsLeads, activeLeads: loadOf.get(u.id) ?? 0,
  }));

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Team</h1>
          <p>Who sees which leads, and who gets new ones.</p>
        </div>
      </div>
      <TeamTable rows={rows} />
    </>
  );
}
