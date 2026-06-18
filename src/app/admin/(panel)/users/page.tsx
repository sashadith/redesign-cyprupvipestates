import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CreateUserForm from "./create-user-form";
import UserRowActions from "./user-row-actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/admin");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Email</th>
              <th className="text-left font-medium px-4 py-2.5">Role</th>
              <th className="text-left font-medium px-4 py-2.5">Active</th>
              <th className="text-left font-medium px-4 py-2.5">Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">{u.name}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{u.email}</td>
                <td className="px-4 py-2.5">{u.role}</td>
                <td className="px-4 py-2.5">{u.isActive ? "✓" : "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <UserRowActions
                    userId={u.id}
                    email={u.email}
                    isActive={u.isActive}
                    isSelf={(session?.user as any)?.id === u.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CreateUserForm />
    </div>
  );
}
