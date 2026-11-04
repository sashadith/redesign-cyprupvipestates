import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { TRASH_LIST_CAP, TRASH_RETENTION_DAYS, toTrashRow } from "@/lib/crm/trashView";
import { TrashList } from "../components/TrashList";

export const dynamic = "force-dynamic";

// Trashed leads, for managers: restore here, delete for good in the old CRM.
export default async function TrashPage() {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/pipeline");

  const leads = await prisma.lead.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: TRASH_LIST_CAP,
    select: { id: true, firstName: true, lastName: true, email: true, source: true, status: true, deletedAt: true, deletedById: true },
  });
  const ids = Array.from(new Set(leads.map((l) => l.deletedById).filter((x): x is string => !!x)));
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const rows = leads.map((l) => toTrashRow(l, names));

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Trash</h1>
          <p>Trashed leads can be restored within {TRASH_RETENTION_DAYS} days. Newest {TRASH_LIST_CAP} shown.</p>
        </div>
        <Link className="crm-ck-old" href="/admin/crm/trash">Permanently delete in the old CRM →</Link>
      </div>
      <TrashList rows={rows} />
    </>
  );
}
