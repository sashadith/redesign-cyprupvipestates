import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "../actions";
import Sidebar, { type NavModule } from "./Sidebar";
import { getActionCenterItems } from "@/lib/actionCenter";

export const dynamic = "force-dynamic";

// CVE Logo NEU Gold.png (Media → Logos), 2048x2048 square (1:1).
const LOGO_SRC = "/uploads/images/05ff9b6142e3a98fa0ef44ae36b302a20bba2e60-2048x2048.png";

// The admin is organised into application MODULES. The primary rail shows the
// modules; multi-page modules (CRM, Website) open a secondary sidebar with their
// pages. `isAdmin` gates ADMIN-only pages (Footer/site settings, Users module).
function buildModules(isAdmin: boolean, trashCount: number, actionCenterCount: number): NavModule[] {
  const websitePages = [
    { href: "/admin/content/featured", label: "Homepage" },
    { href: "/admin/content/projects", label: "Projects" },
    { href: "/admin/content/blog", label: "Blog" },
    { href: "/admin/content/pages", label: "Pages" },
    { href: "/admin/content/case-studies", label: "Case Studies" },
    { href: "/admin/content/developers", label: "Developers" },
    { href: "/admin/content/authors", label: "Authors" },
    { href: "/admin/content/categories", label: "Categories" },
    { href: "/admin/content/header", label: "Header" },
    // Footer = the site-settings editor (footer legal text / contacts / social); ADMIN-only.
    ...(isAdmin ? [{ href: "/admin/settings", label: "Footer" }] : []),
    { href: "/admin/content/forms", label: "Forms" },
    { href: "/admin/content/landing", label: "Landing Pages" },
    { href: "/admin/content/faq", label: "FAQ" },
    { href: "/admin/media", label: "Media" },
  ];

  return [
    { key: "dashboard", label: "Dashboard", pages: [{ href: "/admin", label: "Dashboard", count: actionCenterCount || undefined }] },
    {
      key: "crm",
      label: "CRM",
      pages: [
        { href: "/admin/crm", label: "Leads" },
        { href: "/admin/crm/board", label: "Pipeline" },
        { href: "/admin/crm/trash", label: "Trash", count: trashCount },
      ],
    },
    {
      key: "developments",
      label: "Developers",
      pages: [
        { href: "/admin/developments", label: "All developments" },
        { href: "/admin/developments/areas", label: "Area descriptions" },
        { href: "/admin/developers/publishing-queue", label: "Publishing Queue" },
      ],
    },
    { key: "analytics", label: "Analytics", pages: [{ href: "/admin/analytics", label: "Analytics" }, { href: "/admin/analytics/seo", label: "SEO" }, { href: "/admin/analytics/seo/advisor", label: "SEO Advisor" }] },
    { key: "website", label: "Website", pages: websitePages },
    { key: "settings", label: "Settings", pages: [{ href: "/admin/account", label: "My Account" }] },
    ...(isAdmin
      ? [{ key: "users", label: "Users", pages: [{ href: "/admin/users", label: "Users" }] }]
      : []),
  ];
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) redirect("/admin/login");
  // Re-validate against the DB so a deactivated user loses access immediately,
  // not only when their JWT expires (audit M3).
  const dbUser = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!dbUser || !dbUser.isActive) redirect("/admin/login");
  const user = session.user as any;
  const trashCount = await prisma.lead.count({ where: { deletedAt: { not: null } } });
  const actionCenterCount = (await getActionCenterItems()).length;
  const modules = buildModules(user?.role === "ADMIN", trashCount, actionCenterCount);

  // Developer-grouped nav for the Developments module: WITH FEED vs NO FEED, A-Z.
  // "With feed" = the developer has at least one live (URL/API) feed analysis.
  const developers = await prisma.developerAccount.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true,
      _count: { select: { developments: true } },
      analyses: { select: { sourceType: true } },
      developments: { select: { dev: true }, distinct: ["dev"] },
    },
  });
  // "With feed" = a live (URL/API) analysis OR feed-synced developments (dev key ≠ "manual").
  const hasFeed = (d: (typeof developers)[number]) =>
    d.analyses.some((x) => x.sourceType === "URL" || x.sourceType === "API") ||
    d.developments.some((x) => x.dev && x.dev !== "manual");
  const developersNav = developers.map((d) => ({ id: d.id, name: d.name, count: d._count.developments, hasFeed: hasFeed(d) }));
  const devTotals = {
    developers: developers.length,
    developments: developers.reduce((sum, d) => sum + d._count.developments, 0),
    units: await prisma.developmentUnit.count(),
  };

  return (
    <div className="min-h-screen md:flex bg-[#F8F9FA] font-sans text-[#111827]">
      <Sidebar
        modules={modules}
        developersNav={developersNav}
        devTotals={devTotals}
        user={{ email: user?.email, role: user?.role }}
        logoSrc={LOGO_SRC}
        signOut={logout}
      />
      <main className="flex-1 p-5 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}
