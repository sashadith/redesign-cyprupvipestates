// src/app/partner-portal/layout.tsx — reached only via the partner host (middleware rewrite).
import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import "./portal.css";
import { portalContext } from "./portalContext";
import { PortalShell } from "./components/PortalShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cyprus VIP Estates · Partner", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const { me, locale, t } = await portalContext();
  return (
    <html lang={locale}>
      <body className="pp-app antialiased">
        <PortalShell locale={locale} t={t} loggedIn={!!me}>{children}</PortalShell>
      </body>
    </html>
  );
}
