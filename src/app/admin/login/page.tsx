import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import PasswordInput from "./password-input";

export const dynamic = "force-dynamic";

const LOGO = "/uploads/images/05ff9b6142e3a98fa0ef44ae36b302a20bba2e60-2048x2048.png"; // CVE Logo NEU Gold.png
const inputClass =
  "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string };
}) {
  const session = await auth();
  if (session) redirect("/admin");

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/admin",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/admin/login?error=1");
      throw e; // re-throw NEXT_REDIRECT (success) and others
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] font-sans">
      <form action={login} className="w-full max-w-sm bg-white rounded-lg border border-[#E5E7EB] p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Cyprus VIP Estates" className="h-48 w-auto mx-auto mb-5" />
        <p className="text-sm text-[#6B7280] mb-6 text-center">Admin sign in</p>
        {searchParams?.reset && (
          <p className="mb-4 text-sm text-[#1B4B43] bg-[#1B4B43]/10 rounded px-3 py-2">Password updated — you can sign in now.</p>
        )}
        {searchParams?.error && (
          <p className="mb-4 text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">Invalid email or password</p>
        )}
        <label className="block text-sm text-[#111827] mb-1" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username"
          className={`${inputClass} mb-4`} />
        <label className="block text-sm text-[#111827] mb-1" htmlFor="password">Password</label>
        <div className="mb-6">
          <PasswordInput id="password" name="password" required autoComplete="current-password" className={inputClass} />
        </div>
        <button type="submit"
          className="w-full rounded-md bg-[#1B4B43] text-white text-sm font-medium py-2.5 hover:bg-[#142E2D] transition-colors">
          Sign in
        </button>
        <Link href="/admin/forgot" className="block mt-4 text-center text-xs text-[#6B7280] hover:text-[#1B4B43]">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
