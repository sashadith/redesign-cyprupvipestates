// src/app/crm/layout.tsx
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import "@/app/globals.css";
import "@/app/fonts/vendored.css";
import "./crm.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";
import { prisma } from "@/lib/prisma";
import { inboxWhere } from "@/lib/crm/inboxWhere";
import { nagCountsFor } from "@/lib/crm/leadNagSend";
import { Shell } from "./components/Shell";
import { DsStyle } from "@/lib/design/DsStyle";
import { designForStaff } from "@/lib/design/store";
import { toOptions, effectiveChoice, type ThemeOption } from "@/lib/design/options";
import { CLASSIC, DEFAULT_GLOBAL, cssVars, isDarkSet, type SetValues, type GlobalSettings } from "@/lib/design/theme";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CVE Office", robots: { index: false, follow: false } };

// The viewer's colour set + global design settings. Never throws: on any error the CRM renders
// in Classic with the default settings (identical to the pre-design-settings look).
type ViewerDesign = { values: SetValues; global: GlobalSettings; options: ThemeOption[]; choiceId: string | null };
// React cache() = one lookup per request, shared by generateViewport and the layout.
const viewerDesign = cache(async (userId: string): Promise<ViewerDesign> => {
  try {
    const d = await designForStaff(userId);
    const options = toOptions(d.offered);
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { designThemeId: true } });
    return { values: d.set.values, global: d.global, options, choiceId: effectiveChoice(u?.designThemeId ?? null, options) };
  } catch (err) {
    console.error("[crm design]", err);
    return { values: CLASSIC, global: DEFAULT_GLOBAL, options: [], choiceId: null };
  }
});

// Browser chrome colour follows the viewer's page colour.
export async function generateViewport(): Promise<Viewport> {
  let themeColor = CLASSIC.page;
  try {
    const user = await getCrmUser();
    if (user) themeColor = (await viewerDesign(user.id)).values.page;
  } catch (err) {
    console.error("[crm design]", err);
  }
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor };
}

// Same font wiring as the partner portal and src/app/[lang]/layout.tsx: the `.variable` classes define
// --font-display (Fraunces), --font-body (Mulish) and --font-display-cyr (Playfair Display) on <body>.
const fontVars = `${frauncesFontDisplay.variable} ${mulishFontBody.variable} ${playfairDisplayFontDisplayCyr.variable}`;

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login?callbackUrl=/crm");
  const canAssign = canAssignLeads(user);
  const design = await viewerDesign(user.id);
  return (
    <html lang="en" className="crm-html">
      <head>
        <DsStyle scope="crm" vars={cssVars(design.values, design.global)} />
      </head>
      <body className={`crm-app antialiased ${fontVars}${isDarkSet(design.values) ? " ds-dark" : ""}`}>
        <Shell
          user={{ name: user.name, canAssign, inboxCount: canAssign ? await countInbox() : 0, oldCrm: mayUseOldCrm(user), isOwner: user.isOwner }}
          themes={{ options: design.options, choiceId: design.choiceId }}
          nag={await nagCountsFor(user, new Date())}
        >
          {children}
        </Shell>
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

