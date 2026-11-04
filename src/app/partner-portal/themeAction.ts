"use server";
import { getPartner } from "@/lib/partner/session";
import { setPartnerChoice } from "@/lib/design/store";
import { partnerThemeCore } from "@/lib/design/switchCore";

/** An ACTIVE partner picks one of the sets offered to partners (null = the default). */
export async function setMyPortalThemeAction(themeId: string | null): Promise<{ ok: boolean }> {
  return partnerThemeCore(await getPartner(), themeId, { setChoice: (id, t) => setPartnerChoice(id, t) });
}
