/** Server-side account helpers for the partner portal (tokens, verification, mails). Never import from client code. */
import type { PartnerTokenKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import { sendTelegramMessage } from "@/lib/telegram";
import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";
import { buildRegistrationNotice, buildResetEmail, buildVerifyEmail, partnerBaseUrl } from "./mail";
import { addHours, hashToken, newToken } from "./tokens";

export const VERIFY_HOURS = 48;
export const RESET_HOURS = 1;

/**
 * Fixed bcrypt hash (cost 12) of a random, discarded secret. Login with an unknown e-mail
 * compares against it so the response time matches a real account.
 */
export const DUMMY_PASSWORD_HASH = "$2b$12$U8S9XEYQdhUGL6BUtGOgKeF.FqtfPNFHV6l.XKU2aHwlObTlvUwAy";

export const asLocale = (v: unknown): PartnerLocale =>
  typeof v === "string" && (PARTNER_LOCALES as readonly string[]).includes(v) ? (v as PartnerLocale) : "en";

/** Issues a token of `kind`; older unused tokens of that kind for the user are invalidated first. */
export async function issueToken(partnerUserId: string, kind: PartnerTokenKind, hours: number): Promise<string> {
  const { token, hash } = newToken();
  const now = new Date();
  await prisma.$transaction([
    prisma.partnerToken.updateMany({ where: { partnerUserId, kind, usedAt: null }, data: { usedAt: now } }),
    prisma.partnerToken.create({ data: { partnerUserId, kind, tokenHash: hash, expiresAt: addHours(now, hours) } }),
  ]);
  return token;
}

/** Atomic single use: returns the owner's id only if this call flipped the token to used. */
export async function consumeToken(token: string, kind: PartnerTokenKind): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const res = await prisma.partnerToken.updateMany({
    where: { tokenHash, kind, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (res.count !== 1) return null;
  const row = await prisma.partnerToken.findUnique({ where: { tokenHash }, select: { partnerUserId: true } });
  return row?.partnerUserId ?? null;
}

/** Read-only validity check (for GET renders — never mutates). */
export async function tokenLooksValid(token: string, kind: PartnerTokenKind): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const row = await prisma.partnerToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { kind: true, usedAt: true, expiresAt: true },
  });
  return !!row && row.kind === kind && !row.usedAt && row.expiresAt.getTime() > Date.now();
}

/**
 * Sets emailVerifiedAt if it was still empty. On the first verification the office gets a
 * Telegram notice (best effort, never blocks the partner; skipped for SUSPENDED partners).
 */
export async function markEmailVerified(partnerUserId: string): Promise<void> {
  const res = await prisma.partnerUser.updateMany({
    where: { id: partnerUserId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  if (res.count !== 1) return;
  inBackground(
    "registration notice",
    (async () => {
      const user = await prisma.partnerUser.findUnique({
        where: { id: partnerUserId },
        select: { partner: { select: { company: true, firstName: true, lastName: true, country: true, status: true } } },
      });
      // A suspended partner is not a new registration for the office.
      if (user && user.partner.status !== "SUSPENDED") await sendTelegramMessage(buildRegistrationNotice(user.partner));
    })(),
  );
}

/** Issues a fresh verify token and mails it. */
export async function sendVerifyMail(u: { id: string; email: string; language: unknown; firstName: string }): Promise<void> {
  const token = await issueToken(u.id, "VERIFY_EMAIL", VERIFY_HOURS);
  const link = `${partnerBaseUrl()}/verify?token=${encodeURIComponent(token)}`;
  const mail = buildVerifyEmail(asLocale(u.language), link, u.firstName);
  await sendEmail({ to: u.email, subject: mail.subject, text: mail.text, html: mail.html });
}

/** Issues a fresh reset token and mails it. */
export async function sendResetMail(u: { id: string; email: string; language: unknown; firstName: string }): Promise<void> {
  const token = await issueToken(u.id, "RESET_PASSWORD", RESET_HOURS);
  const link = `${partnerBaseUrl()}/reset?token=${encodeURIComponent(token)}`;
  const mail = buildResetEmail(asLocale(u.language), link, u.firstName);
  await sendEmail({ to: u.email, subject: mail.subject, text: mail.text, html: mail.html });
}

/** Fire-and-forget wrapper: the response must not wait on (or reveal) SMTP. */
export function inBackground(label: string, p: Promise<unknown>): void {
  p.catch((e) => console.error(`[partner] ${label} failed`, e));
}
