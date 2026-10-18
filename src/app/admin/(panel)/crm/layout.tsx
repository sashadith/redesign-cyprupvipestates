import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadCrmUser } from "@/lib/crm/accessUser";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";

// CRM v2 gate (2026-10-18): employees who may only see their own leads work in
// the new CRM at /crm; the old CRM would show them every lead. Known limit: the
// old CRM's server actions are not re-scoped (that would change the old CRM).
export default async function OldCrmGate({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const user = id ? await loadCrmUser(id) : null;
  if (!mayUseOldCrm(user)) redirect("/crm/pipeline");
  return <>{children}</>;
}
