import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "../actions";
import { contractStatus, currentContract, dateToIso, nicosiaToday } from "@/lib/developerContract";
import Sidebar, { type NavModule } from "./Sidebar";
import AdminPerfProbe from "./AdminPerfProbe";
import ActivityTracker from "./ActivityTracker";
import { EXCLUDE_GUIDE, EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER, ONLY_GUIDE, ONLY_NEWSLETTER, ONLY_PARTNER } from "@/lib/crm/leadBucket";

export const dynamic = "force-dynamic";

// CVE Logo NEU Gold.png (Media → Logos), 2048x2048 square (1:1).
const LOGO_SRC = "/uploads/images/05ff9b6142e3a98fa0ef44ae36b302a20bba2e60-2048x2048.png";

// The admin is organised into application MODULES. The primary rail shows the
// modules; multi-page modules (CRM, Website) open a secondary sidebar with their
// pages. `isAdmin` gates ADMIN-only pages (Footer/site settings, Users module).
function buildModules(isAdmin: boolean, isOwner: boolean, trashCount: number, activeLeadCount: number, activePartnerCount: number, newsletterCount: number, activeGuideCount: number): NavModule[] {
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
    // EN→HE translation queue for the volume content (developments, areas, developers).
    { href: "/admin/content/hebrew", label: "Hebrew" },
    { href: "/admin/media", label: "Media" },
  ];

  return [
    // No count here: the Action Center number is fetched by the sidebar after
    // the page renders. See src/app/api/admin/action-center-count/route.ts —
    // computing it inline cost every admin page ~2 s, against 72 ms for all of
    // this layout's own queries combined.
    { key: "dashboard", label: "Dashboard", pages: [{ href: "/admin", label: "Dashboard" }] },
    {
      key: "crm",
      label: "CRM",
      pages: [
        { href: "/admin/crm", label: "Leads", count: activeLeadCount, countVariant: "neutral" },
        { href: "/admin/crm/board", label: "Pipeline" },
        { href: "/admin/crm/calendar", label: "Calendar" },
        { href: "/admin/crm/partners", label: "Partner", count: activePartnerCount, countVariant: "neutral" },
        { href: "/admin/crm/guides", label: "Guide Leads", count: activeGuideCount, countVariant: "neutral" },
        { href: "/admin/crm/newsletter", label: "Newsletter", count: newsletterCount, countVariant: "neutral" },
        { href: "/admin/crm/trash", label: "Trash", count: trashCount, countVariant: "neutral" },
      ],
    },
    {
      key: "developments",
      label: "Developers",
      pages: [
        { href: "/admin/developments", label: "All developments" },
        { href: "/admin/developments/areas", label: "Area descriptions" },
        { href: "/admin/developers/publishing-queue", label: "Publishing Queue" },
        // Per-developer switch deciding whose published projects are delivered
        // to Xellex, the second public portal. Lives in this module because the
        // Developer-Feeds module it was planned under was merged into
        // Developments (see the redirect in (panel)/feeds/page.tsx), and the
        // switch is per developer account like everything else here.
        { href: "/admin/feeds/bridge", label: "Xellex Bridge" },
      ],
    },
    { key: "analytics", label: "Analytics", pages: [{ href: "/admin/analytics", label: "Analytics" }, { href: "/admin/analytics/seo", label: "SEO" }, { href: "/admin/analytics/seo/power", label: "Page Power" }, { href: "/admin/analytics/seo/advisor", label: "SEO Advisor" }] },
    { key: "website", label: "Website", pages: websitePages },
    ...(isAdmin
      ? [{
          key: "users",
          label: "Users",
          // Activity (working-hours report on colleagues) is owner-only, not every ADMIN — see users/activity/page.tsx.
          pages: [{ href: "/admin/users", label: "Users" }, ...(isOwner ? [{ href: "/admin/users/activity", label: "Activity" }] : [])],
        }]
      : []),
  ];
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) redirect("/admin/login");
  // Re-validate against the DB so a deactivated user loses access immediately,
  // not only when their JWT expires (audit M3).
  // Measured so the console probe below can say how much of a slow page is
  // this layout's data gathering and how much is render, network or browser.
  const t0 = Date.now();
  const dbUser = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true, name: true, avatar: true, isOwner: true } });
  if (!dbUser || !dbUser.isActive) redirect("/admin/login");
  const user = session.user as any;
  const [trashCount, activeLeadCount, activePartnerCount, newsletterCount, activeGuideCount] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: { not: null } } }),
    prisma.lead.count({ where: { deletedAt: null, status: { notIn: ["LOST", "CLOSED"] }, AND: [EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER, EXCLUDE_GUIDE] } }),
    prisma.lead.count({ where: { deletedAt: null, status: { notIn: ["LOST", "CLOSED"] }, ...ONLY_PARTNER } }),
    prisma.lead.count({ where: { deletedAt: null, ...ONLY_NEWSLETTER } }),
    prisma.lead.count({ where: { deletedAt: null, status: { notIn: ["LOST", "CLOSED"] }, ...ONLY_GUIDE } }),
  ]);
  const modules = buildModules(user?.role === "ADMIN", dbUser.isOwner, trashCount, activeLeadCount, activePartnerCount, newsletterCount, activeGuideCount);

  // Developer-grouped nav for the Developments module: WITH FEED vs NO FEED, A-Z.
  // "With feed" = the developer has at least one live (URL/API) feed analysis.
  const developers = await prisma.developerAccount.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true,
      _count: { select: { developments: true } },
      analyses: { select: { sourceType: true } },
      developments: { select: { dev: true }, distinct: ["dev"] },
      contracts: { select: { signedAt: true, termMonths: true, autoRenew: true, createdAt: true } },
    },
  });
  const today = nicosiaToday();
  const contractKind = (d: (typeof developers)[number]) => {
    const c = currentContract(d.contracts);
    return contractStatus(c && { signedAt: dateToIso(c.signedAt), termMonths: c.termMonths, autoRenew: c.autoRenew }, today).kind;
  };
  // "With feed" = a live (URL/API) analysis OR feed-synced developments (dev key ≠ "manual").
  const hasFeed = (d: (typeof developers)[number]) =>
    d.analyses.some((x) => x.sourceType === "URL" || x.sourceType === "API") ||
    d.developments.some((x) => x.dev && x.dev !== "manual");
  // Available inventory, not raw totals (2026-09-29, operator request). The box
  // was being read as "what we can still sell" — the all-status unit total
  // (4,636) had already been quoted as the available figure on the public
  // partners page. All three rows now count the same thing: a development that
  // still has at least one unit with status "available", the developers that
  // own one, and those units themselves. Publish status is deliberately NOT a
  // filter here — unlike the public partners band, the admin should see drafts.
  // The per-developer numbers in the list below use the same map, so they still
  // add up to the Developments figure.
  const availableDevs = await prisma.development.findMany({
    where: { units: { some: { status: "available" } } },
    select: { developerAccountId: true },
  });
  const availableByDeveloper = new Map<string, number>();
  for (const d of availableDevs) {
    availableByDeveloper.set(d.developerAccountId, (availableByDeveloper.get(d.developerAccountId) ?? 0) + 1);
  }
  const developersNav = developers.map((d) => ({ id: d.id, name: d.name, count: availableByDeveloper.get(d.id) ?? 0, hasFeed: hasFeed(d), contract: contractKind(d) }));
  const devTotals = {
    developers: developers.filter((d) => (availableByDeveloper.get(d.id) ?? 0) > 0).length,
    developments: availableDevs.length,
    units: await prisma.developmentUnit.count({ where: { status: "available" } }),
  };

  const serverMs = Date.now() - t0;

  return (
    <div className="min-h-screen md:flex bg-[#F8F9FA] font-sans text-[#111827]">
      <AdminPerfProbe serverMs={serverMs} />
      <Sidebar
        modules={modules}
        developersNav={developersNav}
        devTotals={devTotals}
        user={{ email: user?.email, role: user?.role, name: dbUser.name, avatar: dbUser.avatar }}
        logoSrc={LOGO_SRC}
        signOut={logout}
      />
      <main className="flex-1 p-5 md:p-8 overflow-auto">{children}</main>
      <ActivityTracker />
    </div>
  );
}
