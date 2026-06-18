import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ForgotForm from "./forgot-form";

export const dynamic = "force-dynamic";

const LOGO = "/uploads/images/05ff9b6142e3a98fa0ef44ae36b302a20bba2e60-2048x2048.png"; // CVE Logo NEU Gold.png

export default async function ForgotPage() {
  const session = await auth();
  if (session) redirect("/admin");
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] font-sans">
      <div className="w-full max-w-sm bg-white rounded-lg border border-[#E5E7EB] p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Cyprus VIP Estates" className="h-12 w-auto mx-auto mb-5" />
        <p className="text-sm text-[#6B7280] mb-6 text-center">Reset your admin password</p>
        <ForgotForm />
      </div>
    </div>
  );
}
