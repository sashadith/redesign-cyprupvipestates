import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addHours, hashToken, newToken } from "./tokens";

export const PARTNER_COOKIE = "cve_partner";
const SESSION_DAYS = 30;
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

/** Creates a session row and sets the host-only cookie (no Domain attribute). */
export async function createPartnerSession(partnerUserId: string): Promise<void> {
  const { token, hash } = newToken();
  const expiresAt = addHours(new Date(), SESSION_DAYS * 24);
  await prisma.partnerSession.create({ data: { partnerUserId, tokenHash: hash, expiresAt } });
  cookies().set(PARTNER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Valid (unrevoked, unexpired) session of an existing user, else null. Status is returned as-is.
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
  return me;
}

export async function revokeCurrentSession(): Promise<void> {
  const jar = cookies();
  const token = jar.get(PARTNER_COOKIE)?.value;
  if (token) {
    await prisma.partnerSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  jar.delete(PARTNER_COOKIE);
}

export async function revokeAllSessionsForPartner(partnerId: string): Promise<void> {
  await prisma.partnerSession.updateMany({
    where: { revokedAt: null, partnerUser: { partnerId } },
    data: { revokedAt: new Date() },
  });
}
