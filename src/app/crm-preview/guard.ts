import { notFound } from "next/navigation";
import { getCrmUser } from "@/lib/crm/session";

// The preview frames are for the owner's design page only; everyone else gets a 404.
export async function requireOwner(): Promise<void> {
  const user = await getCrmUser();
  if (!user?.isOwner) notFound();
}
