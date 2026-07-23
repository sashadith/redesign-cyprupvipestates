import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import EditUserForm from "./edit-user-form";
import EmailSettingsForm from "../../../account/email-settings-form";
import { getEmailSettings } from "../../../account/actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/admin");
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();
  const viewerId = (session?.user as any)?.id;
  if (user.isOwner && viewerId !== user.id) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold mb-4">Edit user</h1>
        <p className="bg-white rounded-lg border border-[#E5E7EB] p-6 text-sm text-[#6B7280]">
          This is the protected owner account — it can only be edited by the owner themselves, via My account.
        </p>
      </div>
    );
  }

  const emailSettings = await getEmailSettings(user.id);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit user</h1>
      <EditUserForm
        user={{
          id: user.id, name: user.name, email: user.email, role: user.role,
          isActive: user.isActive, avatar: user.avatar, photoPng: user.photoPng, phone: user.phone,
        }}
        isSelf={(session?.user as any)?.id === user.id}
      />
      <EmailSettingsForm userId={user.id} settings={emailSettings} />
    </div>
  );
}
