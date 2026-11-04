import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken, newToken } from "./tokens";
import { partnerSessionMs, partnerSessionWasRemembered } from "@/lib/loginPersistence";
import { needsAgreementAcceptance } from "./agreementGate";

/**
 * Session cookie name. Production (HTTPS) uses the __Host- prefix, which the browser only accepts
 * with Secure, Path=/ and no Domain — so the cookie can never be set for or leak to a sibling host.
 * Plain-http dev cannot use the prefix. Nothing else may hardcode this name.
 */
export const PARTNER_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cve_partner" : "cve_partner";
// Host-only (no Domain); Secure in production, which the __Host- prefix requires.
const COOKIE_OPTS = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const;
const TOUCH_EVERY_MS = 5 * 60_000;

export type PartnerSessionInfo = {
  user: { id: string; email: string };
  partner: {
    id: string;
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
    firstName: string;
    lastName: string;
    company: string | null;
    language: string;
    refCode: string | null;
    managerUserId: string | null;
  };
};

/**
 * Creates a session row and sets the host-only cookie (no Domain attribute).
 * remember ("Keep me signed in", 2026-10-26): 30 days with a persistent cookie; without it 8 hours
 * and a browser-session cookie (no expires), so closing the browser also ends it.
 */
export async function createPartnerSession(partnerUserId: string, remember = true): Promise<void> {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + partnerSessionMs(remember));
  await prisma.partnerSession.create({ data: { partnerUserId, tokenHash: hash, expiresAt } });
  cookies().set(PARTNER_COOKIE, token, remember ? { ...COOKIE_OPTS, expires: expiresAt } : COOKIE_OPTS);
}

/** Whether the session behind the current cookie was a remembered one (true when there is none). */
export async function currentSessionRemembered(): Promise<boolean> {
  const token = cookies().get(PARTNER_COOKIE)?.value;
  if (!token) return true;
  const s = await prisma.partnerSession.findUnique({ where: { tokenHash: hashToken(token) }, select: { createdAt: true, expiresAt: true } });
  return s ? partnerSessionWasRemembered(s) : true;
}

/**
 * Valid (unrevoked, unexpired) session of an existing, not suspended partner, else null.
 * SUSPENDED is treated as logged out (defense in depth: suspending also revokes all sessions).
 * Memoised per request with React cache() (layout + page share one lookup).
 */
export const getPartner = cache(async function getPartner(): Promise<PartnerSessionInfo | null> {
  const token = cookies().get(PARTNER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.partnerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      partnerUser: {
        select: {
          id: true,
          email: true,
          partner: {
            select: { id: true, status: true, firstName: true, lastName: true, company: true, language: true, refCode: true, managerUserId: true },
          },
        },
      },
    },
  });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now || !session.partnerUser) return null;
  if (session.partnerUser.partner.status === "SUSPENDED") return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    // Best effort: a failed touch must never log the partner out.
    await prisma.partnerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => undefined);
  }
  const { partnerUser } = session;
  return {
    user: { id: partnerUser.id, email: partnerUser.email },
    partner: { ...partnerUser.partner, language: String(partnerUser.partner.language) },
  };
});

/** Redirect paths are partner-host paths; the middleware adds the /partner-portal prefix. */
export async function requirePartner(opts: { active?: boolean } = {}): Promise<PartnerSessionInfo> {
  const me = await getPartner();
  if (!me) redirect("/login");
  if (opts.active && me.partner.status !== "ACTIVE") redirect("/home");
  if (await needsAgreementAcceptance(me.partner)) redirect("/agreement");
  return me;
}

export async function revokeCurrentSession(): Promise<void> {
  const jar = cookies();
  const token = jar.get(PARTNER_COOKIE)?.value;
  if (token) {
    await prisma.partnerSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  // Cleared with the same attributes it was set with: a __Host- cookie without Secure is rejected.
  jar.set(PARTNER_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
}

export async function revokeAllSessionsForPartner(partnerId: string): Promise<void> {
  await prisma.partnerSession.updateMany({
    where: { revokedAt: null, partnerUser: { partnerId } },
    data: { revokedAt: new Date() },
  });
}
