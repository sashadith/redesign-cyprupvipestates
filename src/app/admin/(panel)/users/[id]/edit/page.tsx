import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import EditUserForm from "./edit-user-form";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/admin");
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Edit user</h1>
      <EditUserForm
        user={{
          id: user.id, name: user.name, email: user.email, role: user.role,
          isActive: user.isActive, avatar: user.avatar, photoPng: user.photoPng, phone: user.phone,
        }}
        isSelf={(session?.user as any)?.id === user.id}
      />
    </div>
  );
}
