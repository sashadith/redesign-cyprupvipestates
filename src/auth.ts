import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { REMEMBER_DAYS, adminSessionExpired, wantsRemember } from "@/lib/loginPersistence";

// In-memory login throttle (audit M5): block an email after 5 failed attempts within
// 15 minutes. Per-instance; resets on redeploy — adequate for a single-instance deploy.
const loginFails = new Map<string, number[]>();
const LOGIN_WINDOW = 15 * 60_000;
const LOGIN_MAX = 5;
function loginThrottled(email: string) {
  const now = Date.now();
  const ts = (loginFails.get(email) || []).filter((t) => now - t < LOGIN_WINDOW);
  loginFails.set(email, ts);
  return ts.length >= LOGIN_MAX;
}
function recordLoginFail(email: string) {
  const ts = loginFails.get(email) || [];
  ts.push(Date.now());
  loginFails.set(email, ts);
}
function clearLoginFails(email: string) {
  loginFails.delete(email);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 30 days is the cookie/JWT ceiling for a "Keep me signed in" login; an
  // unticked one is cut at 8 hours in the jwt callback (src/lib/loginPersistence.ts).
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * REMEMBER_DAYS },
  trustHost: true,
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, remember: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        if (loginThrottled(email)) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) { recordLoginFail(email); return null; }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) { recordLoginFail(email); return null; }
        clearLoginFails(email);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: user.role, remember: wantsRemember(creds?.remember) } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.uid = (user as any).id;
        token.remember = (user as any).remember === true;
        token.loginAt = Date.now();
        return token;
      }
      // Tokens signed before 2026-10-26 carry neither field: treat them as unticked.
      if (typeof token.loginAt !== "number") {
        token.loginAt = Date.now();
        token.remember = false;
      }
      if (adminSessionExpired({ remember: token.remember === true, loginAt: token.loginAt as number }, Date.now())) return null;
      // A 30-day token must not outlive a deactivation or a role change, so both
      // are re-read on every check (before 2026-10-26 the 8-hour expiry bounded that).
      const dbUser = token.uid
        ? await prisma.user.findUnique({ where: { id: String(token.uid) }, select: { isActive: true, role: true } })
        : null;
      if (!dbUser || !dbUser.isActive) return null;
      token.role = dbUser.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.uid;
      }
      return session;
    },
  },
});
