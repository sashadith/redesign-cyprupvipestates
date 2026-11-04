import { cache } from "react";
import { cookies, headers } from "next/headers";
import { dict, pickPartnerLocale, PARTNER_LANG_COOKIE } from "@/lib/partner/i18n";
import { getPartner } from "@/lib/partner/session";

/** Session + resolved locale + dictionary for the current partner-portal request. */
export const portalContext = cache(async () => {
  const me = await getPartner();
  const locale = pickPartnerLocale({
    partnerLanguage: me?.partner.language,
    cookie: cookies().get(PARTNER_LANG_COOKIE)?.value,
    acceptLanguage: headers().get("accept-language"),
  });
  return { me, locale, t: dict(locale) };
});
