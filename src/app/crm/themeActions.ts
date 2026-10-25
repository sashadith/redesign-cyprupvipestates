"use server";
import { revalidatePath } from "next/cache";
import { getCrmUser } from "@/lib/crm/session";
import { setStaffChoice } from "@/lib/design/store";
import { staffThemeCore } from "@/lib/design/switchCore";

/** The signed-in staff user picks one of the sets offered to staff (null = the default). */
export async function setMyCrmThemeAction(themeId: string | null): Promise<{ ok: boolean }> {
  return staffThemeCore(await getCrmUser(), themeId, {
    setChoice: (id, t) => setStaffChoice(id, t),
    revalidate: () => revalidatePath("/crm", "layout"),
  });
}
