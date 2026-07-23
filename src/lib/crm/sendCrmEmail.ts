// Shared "send an email as a given user, via their own configured SMTP
// connection" helper — extracted from account/actions.ts's sendTestEmail
// (which used to inline the transporter-building code) during the Lead
// Cockpit correction batch, so the new CRM compose/send actions
// (crm/[id]/emailActions.ts) don't duplicate it a second time.
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/secretBox";

export class EmailSettingsMissingError extends Error {}

// Loads + validates the sending user's UserEmailSettings row. Throws
// EmailSettingsMissingError (not a generic Error) so callers can show the
// exact same "fill in SMTP host/user/password/From address" message
// sendTestEmail always has, without re-deriving it themselves.
export async function getUserEmailSettingsRow(userId: string) {
  const row = await prisma.userEmailSettings.findUnique({ where: { userId } });
  if (!row || !row.smtpHost || !row.smtpUser || !row.smtpPasswordEnc || !row.fromAddress) {
    throw new EmailSettingsMissingError("Fill in and save SMTP host, user, password, and From address first.");
  }
  return row;
}

type SettingsRow = Awaited<ReturnType<typeof getUserEmailSettingsRow>>;

function buildTransport(row: SettingsRow) {
  return nodemailer.createTransport({
    host: row.smtpHost!,
    port: row.smtpPort ?? 465,
    secure: (row.smtpPort ?? 465) === 465,
    auth: { user: row.smtpUser!, pass: decrypt(row.smtpPasswordEnc!) },
  });
}

// Sends `to` from the user's own configured SMTP connection, formatted as
// "{fromName} <{fromAddress}>" when a display name is set. `bcc` is used by
// the CRM compose actions to BCC the sending user on every lead email
// (never set by sendTestEmail itself — that already sends directly to
// fromAddress, so a BCC there would just duplicate the same address).
export async function sendUserEmail(
  userId: string,
  opts: { to: string; bcc?: string; subject: string; html: string; text: string },
): Promise<SettingsRow> {
  const row = await getUserEmailSettingsRow(userId);
  const transporter = buildTransport(row);
  await transporter.sendMail({
    from: row.fromName ? `"${row.fromName}" <${row.fromAddress}>` : row.fromAddress!,
    to: opts.to,
    ...(opts.bcc ? { bcc: opts.bcc } : {}),
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return row;
}
