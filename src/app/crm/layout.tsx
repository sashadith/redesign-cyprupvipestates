// src/app/crm/layout.tsx
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import "@/app/globals.css";
import "@/app/fonts/vendored.css";
import "./crm.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";
import { prisma } from "@/lib/prisma";
import { inboxWhere } from "@/lib/crm/inboxWhere";
import { Shell } from "./components/Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CVE Office", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F5F1E8" };

// Same font wiring as the partner portal and src/app/[lang]/layout.tsx: the `.variable` classes define
// --font-display (Fraunces), --font-body (Mulish) and --font-display-cyr (Playfair Display) on <body>.
const fontVars = `${frauncesFontDisplay.variable} ${mulishFontBody.variable} ${playfairDisplayFontDisplayCyr.variable}`;

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login?callbackUrl=/crm");
  const canAssign = canAssignLeads(user);
  return (
    <html lang="en" className="crm-html">
      <body className={`crm-app antialiased ${fontVars}`}>
        <Shell user={{ name: user.name, canAssign, inboxCount: canAssign ? await countInbox() : 0, oldCrm: mayUseOldCrm(user) }}>{children}</Shell>
      </body>
    </html>
  );
}

// The nav badge must never take the whole CRM down: on a failed count it shows 0.
async function countInbox(): Promise<number> {
  try {
    return await prisma.lead.count({ where: inboxWhere() });
  } catch (err) {
    console.error("[crm inbox count]", err);
    return 0;
  }
}

