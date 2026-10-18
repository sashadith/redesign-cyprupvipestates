import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { NewLeadForm } from "../../components/NewLeadForm";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const user = await requireCrmUser();
  const canAssign = canAssignLeads(user);
  const staff = canAssign
    ? await prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>New lead</h1>
          <p>{canAssign ? "Leave the owner empty to send it to the inbox." : "You will own this lead."}</p>
        </div>
      </div>
      <div id="intake-slot" />
      <NewLeadForm canAssign={canAssign} staff={staff} />
    </>
  );
}
