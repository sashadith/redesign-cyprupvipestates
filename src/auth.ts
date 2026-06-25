import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
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
        return { id: user.id, email: user.email, name: user.name, role: user.role } as any;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.uid = (user as any).id;
      }
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
