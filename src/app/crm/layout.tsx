// src/app/crm/layout.tsx
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import "@/app/globals.css";
import "./crm.css";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";
import { inboxWhere } from "@/lib/crm/inboxWhere";
import { Shell } from "./components/Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CVE Office", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login?callbackUrl=/crm");
  const canAssign = canAssignLeads(user);
  return (
    <html lang="en">
      <body className="crm-app antialiased">
        <Shell user={{ name: user.name, canAssign, inboxCount: canAssign ? await countInbox() : 0 }}>{children}</Shell>
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

