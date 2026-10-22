// src/app/crm-preview/crm/layout.tsx — the CRM live-preview frame of /crm/settings/design.
// Same CSS and font wiring as src/app/crm/layout.tsx; no DsStyle (controller ruling R2): the
// :where(.crm-html) fallbacks give Classic until the design page writes
// the owner's draft into its srcdoc copy of this page (see ../previewSrcdoc.ts).
import type { Metadata } from "next";
import "@/app/globals.css";
import "@/app/fonts/vendored.css";
import "@/app/crm/crm.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import { requireOwner } from "../guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CRM preview", robots: { index: false, follow: false } };

const fontVars = `${frauncesFontDisplay.variable} ${mulishFontBody.variable} ${playfairDisplayFontDisplayCyr.variable}`;

export default async function CrmPreviewLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <html lang="en" className="crm-html">
      <body className={`crm-app antialiased ${fontVars}`}>
        {children}
      </body>
    </html>
  );
}
