// src/app/crm-preview/portal/layout.tsx — the partner-portal live-preview frame of /crm/settings/design.
// Same CSS and font wiring as src/app/partner-portal/layout.tsx; no DsStyle (controller ruling R2):
// the :where(.pp-html) fallbacks give Classic until PreviewBridge writes the owner's draft.
import type { Metadata } from "next";
import "@/app/globals.css";
import "@/app/design-tokens.css";
import "@/app/fonts/vendored.css";
import "@/app/partner-portal/portal.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import { requireOwner } from "../guard";
import { PreviewBridge } from "../PreviewBridge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner portal preview", robots: { index: false, follow: false } };

const fontVars = `${frauncesFontDisplay.variable} ${mulishFontBody.variable} ${playfairDisplayFontDisplayCyr.variable}`;

export default async function PortalPreviewLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <html lang="en" data-theme="light" className="pp-html">
      <body className={`pp-app antialiased ${fontVars}`}>
        <PreviewBridge />
        {children}
      </body>
    </html>
  );
}
