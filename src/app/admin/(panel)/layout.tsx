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
          <div className="text-sm font-semibold">Cyprus VIP Estates</div>
          <div className="text-xs text-[#6B7280]">Admin</div>
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
