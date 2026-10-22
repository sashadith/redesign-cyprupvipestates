// src/app/partner-portal/layout.tsx — reached only via the partner host (middleware rewrite).
import type { Metadata, Viewport } from "next";
import { cache } from "react";
import "@/app/globals.css";
import "@/app/design-tokens.css";
import "@/app/fonts/vendored.css";
import "./portal.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import { partnerNewsUnread } from "@/lib/partner/newsStore";
import { DsStyle } from "@/lib/design/DsStyle";
import { designForPartner } from "@/lib/design/store";
import { CLASSIC, DEFAULT_GLOBAL, cssVars, isDarkSet, type SetValues, type GlobalSettings } from "@/lib/design/theme";
import { portalContext } from "./portalContext";
import { PortalShell } from "./components/PortalShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cyprus VIP Estates · Partner", robots: { index: false, follow: false } };

// The viewer's colour set + global design settings (logged-out pages get the default set).
// Never throws: on any error the portal renders in Classic with the default settings, identical
// to the pre-design-settings look. React cache() = one lookup per request, shared by
// generateViewport and the layout (per-request memoisation, not an in-memory cache).
const viewerDesign = cache(async (): Promise<{ values: SetValues; global: GlobalSettings }> => {
  try {
    const { me } = await portalContext();
    const d = await designForPartner(me?.partner.id ?? null);
    return { values: d.set.values, global: d.global };
  } catch (err) {
    console.error("[portal design]", err);
    return { values: CLASSIC, global: DEFAULT_GLOBAL };
  }
});

// Browser chrome colour follows the viewer's page colour.
export async function generateViewport(): Promise<Viewport> {
  const { values } = await viewerDesign();
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: values.page };
}

// Same font wiring as src/app/[lang]/layout.tsx: the `.variable` classes define --font-display (Fraunces),
// --font-body (Mulish) and --font-display-cyr (Playfair Display, Cyrillic display fallback).
const fontVars = `${frauncesFontDisplay.variable} ${mulishFontBody.variable} ${playfairDisplayFontDisplayCyr.variable}`;

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const { me, locale, t } = await portalContext();
  const active = me?.partner.status === "ACTIVE";
  const newsUnread = me && active ? await partnerNewsUnread(me.partner.id) : 0;
  const design = await viewerDesign();
  const dark = isDarkSet(design.values) ? " ds-dark" : "";
  return (
    <html lang={locale} data-theme="light" className={`pp-html${dark}`}>
      <head>
        <DsStyle scope="portal" vars={cssVars(design.values, design.global)} />
      </head>
      <body className={`pp-app antialiased ${fontVars}${dark}`}>
        <PortalShell locale={locale} t={t} loggedIn={!!me} active={active} newsUnread={newsUnread}>{children}</PortalShell>
      </body>
    </html>
  );
}
