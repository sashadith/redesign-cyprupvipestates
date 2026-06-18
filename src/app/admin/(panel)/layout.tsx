import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/crm", label: "CRM / Leads" },
  { href: "/admin/content/projects", label: "Projects" },
  { href: "/admin/content/blog", label: "Blog" },
  { href: "/admin/content/pages", label: "Pages" },
  { href: "/admin/content/case-studies", label: "Case studies" },
  { href: "/admin/content/developers", label: "Developers" },
  { href: "/admin/content/authors", label: "Authors" },
  { href: "/admin/content/categories", label: "Categories" },
  { href: "/admin/content/header", label: "Header" },
  { href: "/admin/content/forms", label: "Forms" },
  { href: "/admin/content/landing", label: "Landing pages" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/account", label: "My account" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const user = session.user as any;
  const items = user?.role === "ADMIN"
    ? [...nav, { href: "/admin/settings", label: "Settings" }, { href: "/admin/users", label: "Users" }]
    : nav;

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] font-sans text-[#111827]">
      <aside className="w-60 shrink-0 bg-white border-r border-[#E5E7EB] flex flex-col">
        <div className="px-5 py-4 border-b border-[#E5E7EB]">
          <Link href="/admin" className="flex items-center gap-2">
            {/* CYPRUS VIP ESTATES Logo v2 1.png (wide ~7:1 — fit sidebar width) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/uploads/images/a8df5b65735f9a45257a17f476806665edbfb421-3585x502.png" alt="Cyprus VIP Estates" className="w-full h-auto" />
          </Link>
          <div className="text-xs text-[#6B7280] mt-1">Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((n) => (
            <Link key={n.href} href={n.href}
              className="block rounded-md px-3 py-2 text-sm text-[#111827] hover:bg-[#1B4B43]/8 hover:text-[#1B4B43]">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[#E5E7EB]">
          <div className="px-3 py-1 text-xs text-[#6B7280] truncate">{user?.email} · {user?.role}</div>
          <form action={logout}>
            <button className="mt-1 w-full text-left rounded-md px-3 py-2 text-sm text-[#C0392B] hover:bg-[#C0392B]/8">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
