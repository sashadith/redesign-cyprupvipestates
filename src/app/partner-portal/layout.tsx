// src/app/partner-portal/layout.tsx — reached only via the partner host (middleware rewrite).
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "@/app/globals.css";
import "./portal.css";
import { dict, pickPartnerLocale, PARTNER_LANG_COOKIE } from "@/lib/partner/i18n";
import { getPartner } from "@/lib/partner/session";
import { PortalShell } from "./components/PortalShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cyprus VIP Estates · Partner", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const me = await getPartner();
  const locale = pickPartnerLocale({
    partnerLanguage: me?.partner.language,
    cookie: cookies().get(PARTNER_LANG_COOKIE)?.value,
    acceptLanguage: headers().get("accept-language"),
  });
  return (
    <html lang={locale}>
      <body className="pp-app antialiased">
        <PortalShell locale={locale} t={dict(locale)} loggedIn={!!me}>{children}</PortalShell>
      </body>
    </html>
  );
}
