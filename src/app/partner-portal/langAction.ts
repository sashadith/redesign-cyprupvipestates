"use server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PARTNER_LANG_COOKIE, PARTNER_LOCALES, type PartnerLocale } from "@/lib/partner/i18n";
import { getPartner } from "@/lib/partner/session";

export async function setPartnerLanguageAction(locale: string): Promise<void> {
  if (!(PARTNER_LOCALES as readonly string[]).includes(locale)) return;
  cookies().set(PARTNER_LANG_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", httpOnly: false, secure: process.env.NODE_ENV === "production" });
  const me = await getPartner();
  if (me) await prisma.partner.update({ where: { id: me.partner.id }, data: { language: locale as PartnerLocale } });
}
