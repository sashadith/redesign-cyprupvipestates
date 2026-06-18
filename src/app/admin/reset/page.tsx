import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ResetForm from "./reset-form";

export const dynamic = "force-dynamic";

const LOGO = "/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png";

export default async function ResetPage({ searchParams }: { searchParams: { token?: string } }) {
  const session = await auth();
  if (session) redirect("/admin");
  const token = searchParams?.token ?? "";
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] font-sans">
      <div className="w-full max-w-sm bg-white rounded-lg border border-[#E5E7EB] p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Cyprus VIP Estates" className="h-12 w-auto mx-auto mb-5" />
        <p className="text-sm text-[#6B7280] mb-6 text-center">Choose a new password</p>
        <ResetForm token={token} />
      </div>
    </div>
  );
}
