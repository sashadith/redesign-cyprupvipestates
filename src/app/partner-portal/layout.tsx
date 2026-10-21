// src/app/partner-portal/layout.tsx — reached only via the partner host (middleware rewrite).
import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import "@/app/design-tokens.css";
import "@/app/fonts/vendored.css";
import "./portal.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import { partnerNewsUnread } from "@/lib/partner/newsStore";
import { portalContext } from "./portalContext";
import { PortalShell } from "./components/PortalShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cyprus VIP Estates · Partner", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F5F1E8" };

// Same font wiring as src/app/[lang]/layout.tsx: the `.variable` classes define --font-display (Fraunces),
// --font-body (Mulish) and --font-display-cyr (Playfair Display, Cyrillic display fallback).
const fontVars = `${frauncesFontDisplay.variable} ${mulishFontBody.variable} ${playfairDisplayFontDisplayCyr.variable}`;

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const { me, locale, t } = await portalContext();
  const active = me?.partner.status === "ACTIVE";
  const newsUnread = me && active ? await partnerNewsUnread(me.partner.id) : 0;
  return (
    <html lang={locale} data-theme="light" className="pp-html">
      <body className={`pp-app antialiased ${fontVars}`}>
        <PortalShell locale={locale} t={t} loggedIn={!!me} active={active} newsUnread={newsUnread}>{children}</PortalShell>
      </body>
    </html>
  );
}
