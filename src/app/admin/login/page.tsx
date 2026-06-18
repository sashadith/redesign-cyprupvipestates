import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
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
        <h1 className="text-xl font-semibold text-[#111827] mb-1">Cyprus VIP Estates</h1>
        <p className="text-sm text-[#6B7280] mb-6">Admin sign in</p>
        {searchParams?.error && (
          <p className="mb-4 text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">Invalid email or password</p>
        )}
        <label className="block text-sm text-[#111827] mb-1" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username"
          className="w-full mb-4 rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]" />
        <label className="block text-sm text-[#111827] mb-1" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password"
          className="w-full mb-6 rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]" />
        <button type="submit"
          className="w-full rounded-md bg-[#1B4B43] text-white text-sm font-medium py-2.5 hover:bg-[#142E2D] transition-colors">
          Sign in
        </button>
      </form>
    </div>
  );
}
