import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./profile-form";
import PasswordForm from "./password-form";
import EmailSettingsForm from "./email-settings-form";
import { getEmailSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) redirect("/admin/login");
  const [user, emailSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { name: true, avatar: true, photoPng: true, phone: true } }),
    getEmailSettings(uid),
  ]);
  if (!user) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My account</h1>
      <ProfileForm name={user.name} avatar={user.avatar} photoPng={user.photoPng} phone={user.phone} />
      <PasswordForm />
      <EmailSettingsForm userId={uid} settings={emailSettings} />
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-lg font-medium">Connected apps</h2>
        <p className="text-sm text-[#6B7280] mt-1">MCP connectors that can read the CRM (claude.ai). <Link href="/admin/mcp" className="underline">Manage connections</Link></p>
      </section>
    </div>
  );
}
