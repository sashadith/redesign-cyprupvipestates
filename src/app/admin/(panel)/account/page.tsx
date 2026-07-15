import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./profile-form";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) redirect("/admin/login");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, avatar: true, photoPng: true, phone: true } });
  if (!user) redirect("/admin/login");

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">My account</h1>
      <ProfileForm name={user.name} avatar={user.avatar} photoPng={user.photoPng} phone={user.phone} />
      <PasswordForm />
    </div>
  );
}
