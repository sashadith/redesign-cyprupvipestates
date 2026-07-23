"use server";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt } from "@/lib/crypto/secretBox";
import { sanitizeSignatureHtml, mirrorSignatureImages, looksLikeHtml, stripHtmlToText, getSignatureHtml } from "@/lib/emailSignature";

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

// Server actions are independently POST-able regardless of which page renders
// their form — the /admin/users/[id]/edit page already redirects non-ADMINs,
// but that page-level gate doesn't protect the action itself from a direct
// call. Every cross-user path here must re-check ADMIN, not just the
// owner-protection guard above (which only ever protects the *owner's* row,
// never checks who the *actor* is allowed to touch).
async function requireAdminForOtherUser(session: any, targetUserId: string) {
  const actorId = (session.user as any).id as string;
  if (actorId === targetUserId) return; // self-service always allowed
  if ((session.user as any)?.role !== "ADMIN") throw new Error("Forbidden");
  await assertOwnerUnprotected(session, targetUserId);
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
  const session = await requireSession();
  await requireAdminForOtherUser(session, userId);
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
  try {
    await requireAdminForOtherUser(session, targetUserId);
  } catch (e: any) {
    return { error: e.message };
  }

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const port = (k: string) => { const v = str(k); return v === "" ? null : Math.round(Number(v)); };

  const smtpPassword = str("smtpPassword");
  const imapPassword = str("imapPassword");
  if ((smtpPassword || imapPassword) && !process.env.SETTINGS_ENCRYPTION_KEY) {
    return { error: "Email credential storage isn't configured on this environment yet (missing SETTINGS_ENCRYPTION_KEY). Ask an admin to set it up first." };
  }

  // HTML-like input gets sanitized (strip doc wrapper, drop scripts/handlers/
  // javascript: URLs) and has its external images mirrored to our own
  // storage; plain text (including all pre-upgrade signatures) passes
  // through untouched — content-based, not a stored flag, so nothing needs
  // re-entry. See src/lib/emailSignature/. Images that fail to mirror (bad
  // format, SSRF-blocked, oversized, etc.) keep their original external URL
  // — never silent: each is console.warn'd in mirrorSignatureImages, and the
  // count surfaces in the save confirmation below.
  const processSignature = async (raw: string): Promise<{ html: string; failedCount: number }> => {
    if (!raw || !looksLikeHtml(raw)) return { html: raw, failedCount: 0 };
    const sanitized = sanitizeSignatureHtml(raw);
    return mirrorSignatureImages(sanitized, targetUserId);
  };
  const [sigEn, sigDe, sigPl, sigRu] = await Promise.all([
    processSignature(str("signatureEn")),
    processSignature(str("signatureDe")),
    processSignature(str("signaturePl")),
    processSignature(str("signatureRu")),
  ]);
  const failedImageCount = sigEn.failedCount + sigDe.failedCount + sigPl.failedCount + sigRu.failedCount;

  const data: any = {
    fromName: str("fromName") || null,
    fromAddress: str("fromAddress") || null,
    smtpHost: str("smtpHost") || null,
    smtpPort: port("smtpPort"),
    smtpUser: str("smtpUser") || null,
    imapHost: str("imapHost") || null,
    imapPort: port("imapPort"),
    imapUser: str("imapUser") || null,
    signature: { en: sigEn.html, de: sigDe.html, pl: sigPl.html, ru: sigRu.html },
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
  const imageWarning = failedImageCount
    ? ` (${failedImageCount} signature image${failedImageCount === 1 ? "" : "s"} could not be mirrored — kept as external link${failedImageCount === 1 ? "" : "s"}; see server logs.)`
    : "";
  return { ok: `Email settings saved.${imageWarning}` };
}

export async function sendTestEmail(targetUserId: string): Promise<{ error?: string; ok?: string }> {
  const session = await requireSession();
  try {
    await requireAdminForOtherUser(session, targetUserId);
  } catch (e: any) {
    return { error: e.message };
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
    // Multipart so the real rendering (table layout, images) can be checked
    // in an actual mail client, not just the admin's own preview iframe.
    const testBodyHtml = "<p>This confirms your email connection settings are working.</p>";
    const signatureHtml = await getSignatureHtml(targetUserId, "en");
    const html = signatureHtml ? `${testBodyHtml}${signatureHtml}` : testBodyHtml;
    const text = stripHtmlToText(html);
    await transporter.sendMail({
      from: row.fromName ? `"${row.fromName}" <${row.fromAddress}>` : row.fromAddress,
      to: row.fromAddress,
      subject: "Cyprus VIP Estates — test email",
      html,
      text,
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
