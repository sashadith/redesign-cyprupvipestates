import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";

export async function sendEmail({
  subject,
  text,
  html,
  replyTo,
  to,
}: {
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  to?: string;
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 465),
    secure: String(process.env.EMAIL_SECURE || "true") === "true",
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER!,
    to: to || process.env.EMAIL_TO || process.env.EMAIL_USER!,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}

// Developer registrations (2026-10-28): the office mailbox writes to a third
// party with a CC list and needs the Message-ID back, because a developer's
// reply is matched to the registration by In-Reply-To. office@ is the sender,
// so it is never repeated in CC, and CC never repeats a To address.
export type OfficeMail = { to: string[]; cc?: string[]; subject: string; text: string };

const SEND_TIMEOUT_MS = 30_000;

export function buildOfficeMail(mail: OfficeMail, office: string, messageId: string) {
  const norm = (a: string) => a.trim().toLowerCase();
  const to = Array.from(new Set(mail.to.map(norm).filter(Boolean)));
  const skip = new Set(to.concat(norm(office)));
  const cc = Array.from(new Set((mail.cc ?? []).map(norm).filter((a) => a && !skip.has(a))));
  return {
    from: office,
    to: to.join(", "),
    ...(cc.length ? { cc: cc.join(", ") } : {}),
    replyTo: office,
    subject: mail.subject,
    text: mail.text,
    messageId,
  };
}

// One attempt, 30 s budget, no retry: a failed registration is resent by hand.
export async function sendOfficeEmail(mail: OfficeMail): Promise<{ messageId: string }> {
  const office = process.env.EMAIL_USER!;
  const messageId = `<${randomUUID()}@cyprusvipestates.com>`;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 465),
    secure: String(process.env.EMAIL_SECURE || "true") === "true",
    auth: { user: office, pass: process.env.EMAIL_PASSWORD! },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });
  await transporter.sendMail(buildOfficeMail(mail, office, messageId));
  return { messageId };
}
