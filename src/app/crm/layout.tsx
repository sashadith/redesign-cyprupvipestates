// src/app/crm/layout.tsx
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import "@/app/globals.css";
import "./crm.css";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { Shell } from "./components/Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CVE Office", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login?callbackUrl=/crm");
  const canAssign = canAssignLeads(user);
  const inboxCount = canAssign
    ? await prisma.lead.count({ where: { deletedAt: null, assignedToId: null, ...EXCLUDE_NEWSLETTER } })
    : 0;
  return (
    <html lang="en">
      <body className="crm-app antialiased">
        <Shell user={{ name: user.name, canAssign, inboxCount }}>{children}</Shell>
      </body>
    </html>
  );
}
