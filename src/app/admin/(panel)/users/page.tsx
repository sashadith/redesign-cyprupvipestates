import Link from "next/link";
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
  const viewerId = (session?.user as any)?.id;
  const viewerIsOwner = users.find((u) => u.id === viewerId)?.isOwner ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
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
            {users.map((u) => {
              const controlsHidden = u.isOwner && !viewerIsOwner;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      {u.name}
                      {u.isOwner && (
                        <span className="rounded-full bg-[#C29A5E]/15 text-[#8E6B3D] text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                          Owner
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#6B7280]">{u.email}</td>
                  <td className="px-4 py-2.5">{u.role}</td>
                  <td className="px-4 py-2.5">{u.isActive ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5 text-[#6B7280]">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {controlsHidden ? (
                      <span className="text-xs text-[#9CA3AF]">Protected</span>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/admin/users/${u.id}/edit`} className="text-xs text-[#1B4B43] hover:underline">Edit</Link>
                        <UserRowActions
                          userId={u.id}
                          email={u.email}
                          isActive={u.isActive}
                          isSelf={viewerId === u.id}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CreateUserForm />
    </div>
  );
}
