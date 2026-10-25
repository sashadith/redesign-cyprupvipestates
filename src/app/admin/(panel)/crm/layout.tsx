import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadCrmUser } from "@/lib/crm/accessUser";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";

// CRM v2 gate (2026-10-18): employees who may only see their own leads work in
// the new CRM at /crm; the old CRM would show them every lead. The CSV export
// route applies the same gate. Known limits (not re-scoped, that would change
// the old CRM): the old CRM's server actions, /api/admin/presentations
// (session-only check) and the lead panels on the /admin dashboard.
export default async function OldCrmGate({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) redirect("/admin/login");
  const user = await loadCrmUser(id);
  if (!mayUseOldCrm(user)) redirect("/crm/pipeline");
  return <>{children}</>;
}
