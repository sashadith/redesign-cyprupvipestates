import nodemailer from "nodemailer";

export async function sendEmail({
  subject,
  text,
  html,
  replyTo,
}: {
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
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
    to: process.env.EMAIL_TO || process.env.EMAIL_USER!,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}
