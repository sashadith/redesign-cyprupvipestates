"use server";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt } from "@/lib/crypto/secretBox";

// Self-contained session gate (same reasoning as presentationActions.ts's own
// copy: exporting requireSession from the main admin/actions.ts "use server"
// file would turn an internal auth helper into a publicly-callable action).
async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

// Owner-mutation guard — same pattern as admin/actions.ts's assertOwnerUnprotected,
// duplicated here for the same reason requireSession is: this file's actions
// are directly server-action-callable, so the guard must live wherever it's used.
async function assertOwnerUnprotected(session: any, targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { isOwner: true } });
  if (!target) return target;
  const actor = session.user as any;
  if (target.isOwner && actor.id !== targetId) {
    await prisma.adminAuditLog.create({
      data: {
        actorId: actor.id, actorName: actor.name, actorEmail: actor.email,
        action: "owner_mutation_blocked", targetType: "User", targetId,
        detail: { attemptedAction: "email_settings_update" },
      },
    });
    throw new Error("The owner account's email connection cannot be edited by other users.");
  }
  return target;
}

export type EmailSettingsView = {
  fromName: string;
  fromAddress: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpConfigured: boolean;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapConfigured: boolean;
  signature: { en: string; de: string; pl: string; ru: string };
  lastTestSentAt: Date | null;
  lastTestOk: boolean | null;
};

const EMPTY_VIEW: EmailSettingsView = {
  fromName: "", fromAddress: "",
  smtpHost: "", smtpPort: "", smtpUser: "", smtpConfigured: false,
  imapHost: "", imapPort: "", imapUser: "", imapConfigured: false,
  signature: { en: "", de: "", pl: "", ru: "" },
  lastTestSentAt: null, lastTestOk: null,
};

// Read path — never returns ciphertext or plaintext, only a "configured"
// boolean per credential, matching the "configured ✓, replace-only input"
// requirement.
export async function getEmailSettings(userId: string): Promise<EmailSettingsView> {
  const row = await prisma.userEmailSettings.findUnique({ where: { userId } });
  if (!row) return EMPTY_VIEW;
  const sig = (row.signature as any) ?? {};
  return {
    fromName: row.fromName ?? "",
    fromAddress: row.fromAddress ?? "",
    smtpHost: row.smtpHost ?? "",
    smtpPort: row.smtpPort != null ? String(row.smtpPort) : "",
    smtpUser: row.smtpUser ?? "",
    smtpConfigured: !!row.smtpPasswordEnc,
    imapHost: row.imapHost ?? "",
    imapPort: row.imapPort != null ? String(row.imapPort) : "",
    imapUser: row.imapUser ?? "",
    imapConfigured: !!row.imapPasswordEnc,
    signature: { en: sig.en ?? "", de: sig.de ?? "", pl: sig.pl ?? "", ru: sig.ru ?? "" },
    lastTestSentAt: row.lastTestSentAt,
    lastTestOk: row.lastTestOk,
  };
}

export async function updateEmailSettings(
  targetUserId: string,
  _prev: any,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const session = await requireSession();
  const actorId = (session.user as any).id as string;
  if (actorId !== targetUserId) {
    try {
      await assertOwnerUnprotected(session, targetUserId);
    } catch (e: any) {
      return { error: e.message };
    }
  }

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const port = (k: string) => { const v = str(k); return v === "" ? null : Math.round(Number(v)); };

  const smtpPassword = str("smtpPassword");
  const imapPassword = str("imapPassword");
  if ((smtpPassword || imapPassword) && !process.env.SETTINGS_ENCRYPTION_KEY) {
    return { error: "Email credential storage isn't configured on this environment yet (missing SETTINGS_ENCRYPTION_KEY). Ask an admin to set it up first." };
  }

  const data: any = {
    fromName: str("fromName") || null,
    fromAddress: str("fromAddress") || null,
    smtpHost: str("smtpHost") || null,
    smtpPort: port("smtpPort"),
    smtpUser: str("smtpUser") || null,
    imapHost: str("imapHost") || null,
    imapPort: port("imapPort"),
    imapUser: str("imapUser") || null,
    signature: {
      en: str("signatureEn"),
      de: str("signatureDe"),
      pl: str("signaturePl"),
      ru: str("signatureRu"),
    },
  };
  // Replace-only: an empty password field means "leave whatever's already
  // stored" — never overwrite with an empty/decoy value.
  if (smtpPassword) data.smtpPasswordEnc = encrypt(smtpPassword);
  if (imapPassword) data.imapPasswordEnc = encrypt(imapPassword);

  await prisma.userEmailSettings.upsert({
    where: { userId: targetUserId },
    create: { userId: targetUserId, ...data },
    update: data,
  });

  revalidatePath("/admin/account");
  revalidatePath(`/admin/users/${targetUserId}/edit`);
  return { ok: "Email settings saved." };
}

export async function sendTestEmail(targetUserId: string): Promise<{ error?: string; ok?: string }> {
  const session = await requireSession();
  const actorId = (session.user as any).id as string;
  if (actorId !== targetUserId) {
    try {
      await assertOwnerUnprotected(session, targetUserId);
    } catch (e: any) {
      return { error: e.message };
    }
  }

  const row = await prisma.userEmailSettings.findUnique({ where: { userId: targetUserId } });
  if (!row || !row.smtpHost || !row.smtpUser || !row.smtpPasswordEnc || !row.fromAddress) {
    return { error: "Fill in and save SMTP host, user, password, and From address first." };
  }

  let ok = false;
  let errorMessage: string | undefined;
  try {
    const transporter = nodemailer.createTransport({
      host: row.smtpHost,
      port: row.smtpPort ?? 465,
      secure: (row.smtpPort ?? 465) === 465,
      auth: { user: row.smtpUser, pass: decrypt(row.smtpPasswordEnc) },
    });
    await transporter.sendMail({
      from: row.fromName ? `"${row.fromName}" <${row.fromAddress}>` : row.fromAddress,
      to: row.fromAddress,
      subject: "Cyprus VIP Estates — test email",
      text: "This confirms your email connection settings are working.",
    });
    ok = true;
  } catch (e: any) {
    errorMessage = e?.message || "Send failed.";
  }

  await prisma.userEmailSettings.update({
    where: { userId: targetUserId },
    data: { lastTestSentAt: new Date(), lastTestOk: ok },
  });
  revalidatePath("/admin/account");
  revalidatePath(`/admin/users/${targetUserId}/edit`);

  return ok ? { ok: `Test email sent to ${row.fromAddress}.` } : { error: errorMessage };
}
