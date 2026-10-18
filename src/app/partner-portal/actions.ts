"use server";
/**
 * Partner-portal form actions. Every action re-checks throttles and input on the server and never
 * trusts client state; profile/password changes are scoped to the session's partner only.
 * Redirect targets are partner-host paths (the middleware adds the /partner-portal prefix).
 * logoutAction lives in ./sessionActions, the language switch in ./langAction.
 */
import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/partner/agreement";
import {
  DUMMY_PASSWORD_HASH, consumeToken, inBackground, markEmailVerified, sendResetMail, sendVerifyMail,
} from "@/lib/partner/accounts";
import { partnerClientIp } from "@/lib/partner/clientIp";
import { PARTNER_LANG_COOKIE } from "@/lib/partner/i18n";
import { ipKey, partnerLimits as L } from "@/lib/partner/limits";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/partner/password";
import { validateProfile, validateRegistration } from "@/lib/partner/registration";
import { createPartnerSession, getPartner, revokeAllSessionsForPartner } from "@/lib/partner/session";
import type { FormState } from "./formState";

const field = (fd: FormData, k: string): string => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
const normEmail = (s: string) => s.trim().toLowerCase().slice(0, 254);
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const requestIp = () => partnerClientIp(headers());
const pwCode = (p: NonNullable<ReturnType<typeof passwordProblem>>) =>
  p === "too_short" ? "err.passwordShort" : p === "too_long" ? "err.passwordLong" : "err.passwordDigits";

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = requestIp();
  const raw: Record<string, unknown> = {};
  for (const k of ["firstName", "lastName", "company", "country", "phone", "email", "language", "type", "password"]) raw[k] = field(fd, k);
  raw.acceptAgreement = fd.get("acceptAgreement") === "on";
  const v = validateRegistration(raw);
  if (!v.ok) return { error: v.code, field: v.field };
  const d = v.data;
  // Counted only for valid submissions (validation is cheap; a few typos must not lock anyone out).
  if (!L.registerIp.hit(ipKey(ip)) || !L.registerEmail.hit(d.email)) return { error: "err.rateLimited" };

  // Hash first, always: an existing e-mail costs the same time as a new one (no enumeration).
  const passwordHash = await hashPassword(d.password);
  const existing = await prisma.partnerUser.findUnique({ where: { email: d.email }, select: { id: true } });
  if (existing) return { ok: true, email: d.email };

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: {
          status: "PENDING", type: d.type, firstName: d.firstName, lastName: d.lastName, company: d.company,
          country: d.country, phone: d.phone, language: d.language,
        },
        select: { id: true },
      });
      const user = await tx.partnerUser.create({ data: { partnerId: partner.id, email: d.email, passwordHash }, select: { id: true } });
      await tx.partnerAgreementAcceptance.create({ data: { partnerId: partner.id, version: PARTNER_AGREEMENT_VERSION, ip } });
      return user.id;
    });
  } catch (e) {
    // A concurrent registration with the same e-mail lost the race: same neutral answer.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, email: d.email };
    console.error("[partner] registration failed", e);
    return { error: "err.generic" };
  }
  inBackground("verify mail", sendVerifyMail({ id: userId, email: d.email, language: d.language, firstName: d.firstName }));
  return { ok: true, email: d.email };
}

// ─── E-mail verification ─────────────────────────────────────────────────────

export async function verifyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!L.tokenIp.hit(ipKey(requestIp()))) return { error: "err.rateLimited" };
  const userId = await consumeToken(field(fd, "token"), "VERIFY_EMAIL");
  if (!userId) return { error: "verify.invalid", resend: true };
  await markEmailVerified(userId);
  const user = await prisma.partnerUser.findUnique({ where: { id: userId }, select: { partner: { select: { status: true } } } });
  if (!user || user.partner.status === "SUSPENDED") redirect("/login");
  await createPartnerSession(userId);
  redirect("/home");
}

/** Always answers neutrally; only an existing, unverified account gets a new link. */
export async function resendVerifyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = normEmail(field(fd, "email"));
  if (!L.resendIp.hit(ipKey(requestIp()))) return { error: "err.rateLimited" };
  if (!looksLikeEmail(email)) return { error: "err.email", field: "email" };
  if (L.resendEmail.hit(email)) {
    const user = await prisma.partnerUser.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifiedAt: true, partner: { select: { language: true, firstName: true, status: true } } },
    });
    if (user && !user.emailVerifiedAt && user.partner.status !== "SUSPENDED") {
      inBackground("verify mail (resend)", sendVerifyMail({ id: user.id, email: user.email, language: user.partner.language, firstName: user.partner.firstName }));
    }
  }
  return { ok: true };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = normEmail(field(fd, "email"));
  const password = field(fd, "password");
  if (!L.loginIp.hit(ipKey(requestIp()))) return { error: "err.rateLimited" };
  if (!email || !password) return { error: "login.errorGeneric" };
  if (!L.loginEmail.hit(email)) return { error: "err.rateLimited" };

  const user = await prisma.partnerUser.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerifiedAt: true, partner: { select: { status: true } } },
  });
  // Unknown e-mail still pays for one bcrypt compare, so timing does not reveal accounts.
  const okPw = await verifyPassword(password.slice(0, 200), user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !okPw || user.partner.status === "SUSPENDED") return { error: "login.errorGeneric" };
  if (!user.emailVerifiedAt) return { error: "login.verifyFirst", resend: true, email };

  L.loginEmail.reset(email);
  await prisma.partnerUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createPartnerSession(user.id);
  redirect("/home");
}

// ─── Forgot / reset password ─────────────────────────────────────────────────

/** Always the same neutral answer, whether or not the e-mail exists (and also when throttled). */
export async function forgotAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = normEmail(field(fd, "email"));
  if (!looksLikeEmail(email)) return { error: "err.email", field: "email" };
  if (L.forgotIp.hit(ipKey(requestIp())) && L.forgotEmail.hit(email)) {
    const user = await prisma.partnerUser.findUnique({
      where: { email },
      select: { id: true, email: true, partner: { select: { language: true, firstName: true, status: true } } },
    });
    if (user && user.partner.status !== "SUSPENDED") {
      inBackground("reset mail", sendResetMail({ id: user.id, email: user.email, language: user.partner.language, firstName: user.partner.firstName }));
    }
  }
  return { ok: true };
}

export async function resetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!L.tokenIp.hit(ipKey(requestIp()))) return { error: "err.rateLimited" };
  const password = field(fd, "password");
  const pp = passwordProblem(password);
  if (pp) return { error: pwCode(pp), field: "password" };
  // Hash before consuming, so a slow/failed hash never burns the link.
  const passwordHash = await hashPassword(password);
  const userId = await consumeToken(field(fd, "token"), "RESET_PASSWORD");
  if (!userId) return { error: "reset.invalid" };

  const user = await prisma.partnerUser.update({
    where: { id: userId },
    data: { passwordHash },
    select: { partnerId: true, partner: { select: { status: true } } },
  });
  // The reset link proves control of the mailbox.
  await markEmailVerified(userId);
  await revokeAllSessionsForPartner(user.partnerId);
  if (user.partner.status === "SUSPENDED") return { ok: true };
  await createPartnerSession(userId);
  redirect("/home");
}

// ─── Profile (logged in) ─────────────────────────────────────────────────────

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await getPartner();
  if (!me) redirect("/login");
  if (!L.changePassword.hit(me.user.id)) return { error: "err.rateLimited" };

  const current = field(fd, "currentPassword");
  const next = field(fd, "newPassword");
  const row = await prisma.partnerUser.findUnique({ where: { id: me.user.id }, select: { passwordHash: true } });
  if (!row || !current || !(await verifyPassword(current.slice(0, 200), row.passwordHash))) {
    return { error: "err.currentPassword", field: "currentPassword" };
  }
  const pp = passwordProblem(next);
  if (pp) return { error: pwCode(pp), field: "newPassword" };

  await prisma.partnerUser.update({ where: { id: me.user.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeAllSessionsForPartner(me.partner.id);
  await createPartnerSession(me.user.id);
  return { ok: true };
}

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await getPartner();
  if (!me) redirect("/login");
  if (!L.profile.hit(me.partner.id)) return { error: "err.rateLimited" };

  const v = validateProfile({
    firstName: field(fd, "firstName"),
    lastName: field(fd, "lastName"),
    company: field(fd, "company"),
    language: field(fd, "language"),
  });
  if (!v.ok) return { error: v.code, field: v.field };

  // Scoped to the session's partner — never an id from the form.
  await prisma.partner.update({ where: { id: me.partner.id }, data: v.data });
  cookies().set(PARTNER_LANG_COOKIE, v.data.language, {
    maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", httpOnly: false, secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/partner-portal", "layout");
  return { ok: true };
}
