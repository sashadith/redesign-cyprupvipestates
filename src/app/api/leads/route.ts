// Lead capture → Postgres (Lead) + Telegram + email notifications.
// Replaces the former Monday.com flow. Preserves the existing anti-spam protections so
// existing frontend forms work unchanged (they POST the same body shape).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getAutoReplyEmail } from "@/lib/emailTemplates";
import { parseAttribution } from "@/lib/attribution";
import { recordInboundLead } from "@/lib/leadNotify";
import { ALLOWED_HOSTS, safeUrl, escapeHtml, blocked, guardRequest, spamSignal, makeRateLimiter } from "@/lib/antispam";
import nodemailer from "nodemailer";

const LOCALES = new Set(["en", "de", "pl", "ru"]);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: Number(process.env.EMAIL_PORT || 465),
  secure: String(process.env.EMAIL_SECURE || "true") === "true",
  auth: { user: process.env.EMAIL_USER!, pass: process.env.EMAIL_PASSWORD! },
});

const ipLimiter = makeRateLimiter();
const emailLimiter = makeRateLimiter();

function leadSource(page: string) {
  if (/\/projects\//.test(page)) return "PROJECT_ENQUIRY" as const;
  if (/\/blog\//.test(page)) return "BLOG_ENQUIRY" as const;
  return "CONTACT_FORM" as const;
}

export async function POST(request: Request) {
  const guard = guardRequest(request, ipLimiter);
  if (guard) return guard;
  const referer = request.headers.get("referer") || "";

  try {
    const body = await request.json();
    const { name, surname, phone, email, message, preferredContact, currentPage, lang } = body;

    const page = String(currentPage ?? "").trim();
    const pageUrl = safeUrl(page);
    if (!pageUrl || !ALLOWED_HOSTS.has(pageUrl.hostname)) return blocked("bad_page");
    const refUrl = safeUrl(referer);
    if (!refUrl || refUrl.hostname !== pageUrl.hostname) return blocked("page_mismatch");

    // Honeypot + timing anti-spam
    const spam = spamSignal(body);
    if (spam) return blocked(spam);

    // Validation
    const firstName = String(name ?? "").trim();
    const lastName = String(surname ?? "").trim();
    const emailNorm = String(email ?? "").trim().toLowerCase();
    const phoneNorm = String(phone ?? "").trim();
    const preferred = String(preferredContact ?? "").trim().toLowerCase();
    const messageNorm = String(message ?? "").trim();
    const langNorm = String(lang ?? "").toLowerCase();

    if (!firstName || !phoneNorm || !emailNorm) return blocked("missing_fields");
    if (preferred && !["phone", "whatsapp", "email"].includes(preferred)) return blocked("preferredContact");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return blocked("email");
    if (emailLimiter(emailNorm, 3, 60_000)) return blocked("rate_limit_email");
    if (firstName.length < 2 || firstName.length > 60) return blocked("name");
    if (lastName && (lastName.length < 2 || lastName.length > 60)) return blocked("surname");
    if (phoneNorm.length < 7 || phoneNorm.length > 25) return blocked("phone");

    // Qualification fields (all optional — backward compatible with the basic form)
    const BUDGETS: Record<string, [number | null, number | null]> = {
      "0-200000": [null, 200000],
      "200000-500000": [200000, 500000],
      "500000-1000000": [500000, 1000000],
      "1000000-2000000": [1000000, 2000000],
      "2000000-": [2000000, null],
    };
    const TIMELINES: Record<string, string> = { now: "IMMEDIATE", "3m": "THREE_MONTHS", "6m": "SIX_MONTHS", "1y": "ONE_YEAR", exploring: "JUST_LOOKING" };
    const FINANCING: Record<string, string> = { cash: "CASH", mortgage: "MORTGAGE", undecided: "UNDECIDED" };
    const PROP_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];

    const nationality = String(body.nationality ?? "").trim() || null;
    const [budgetMin, budgetMax] = BUDGETS[String(body.budget ?? "")] ?? [null, null];
    const timeline = TIMELINES[String(body.timeline ?? "")] ?? null;
    const financing = FINANCING[String(body.financing ?? "")] ?? null;
    const propertyTypeInterest = Array.isArray(body.propertyTypeInterest)
      ? body.propertyTypeInterest.map(String).filter((t: string) => PROP_TYPES.includes(t))
      : [];

    // Link to a project when the form was submitted from / pre-selected a project
    let projectInterestId: string | null = null;
    let source = leadSource(page);
    const projectSlug = String(body.projectSlug ?? "").trim();
    if (projectSlug && LOCALES.has(langNorm)) {
      const proj = await prisma.project.findFirst({ where: { slug: projectSlug, language: langNorm as any }, select: { id: true } });
      if (proj) { projectInterestId = proj.id; source = "PROJECT_ENQUIRY"; }
    }

    // Persist to Postgres
    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName: lastName || "",
        email: emailNorm,
        phone: phoneNorm,
        message: messageNorm || null,
        notes: preferred ? `Preferred contact: ${preferred}` : null,
        source: source as any,
        status: "NEW",
        nationality,
        budgetMin,
        budgetMax,
        timeline: timeline as any,
        financing: financing as any,
        propertyTypeInterest,
        projectInterestId,
        languagePreference: LOCALES.has(langNorm) ? (langNorm as any) : null,
        pageSource: page,
        ...parseAttribution(body),
      },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
    const crmLink = `${siteUrl}/admin/crm/${lead.id}`;
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    // Timeline entry (audit L1). This route does its own Telegram below, so skip it here.
    await recordInboundLead({ leadId: lead.id, source, email: emailNorm, name: fullName, phone: phoneNorm, page, notifyTelegram: false });

    // Telegram notification (non-fatal)
    const tg =
      `<b>🏠 New Lead — Cyprus VIP Estates</b>\n\n` +
      `<b>${escapeHtml(fullName || "-")}</b>\n` +
      `📧 ${escapeHtml(emailNorm)}\n📱 ${escapeHtml(phoneNorm)}\n` +
      `Preferred: ${escapeHtml(preferred)}\n` +
      (messageNorm ? `💬 ${escapeHtml(messageNorm)}\n` : "") +
      `🔗 ${escapeHtml(page)}\n\n<a href="${crmLink}">Open in CRM</a>`;
    let tgOk = false;
    try { await sendTelegramMessage(tg); tgOk = true; await prisma.lead.update({ where: { id: lead.id }, data: { telegramNotified: true } }); }
    catch (e) { console.error("Telegram error:", e); }

    // Email notification to team (non-fatal)
    let emailOk = false;
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER!,
        to: process.env.EMAIL_TO || "office@cyprusvipestates.com",
        subject: `New Lead: ${fullName}`,
        text: `New lead ${fullName} — ${emailNorm} / ${phoneNorm}. CRM: ${crmLink}`,
        html: `<h2>New Lead — Cyprus VIP Estates</h2>
          <p><b>Name:</b> ${escapeHtml(fullName)}</p>
          <p><b>Email:</b> ${escapeHtml(emailNorm)}</p>
          <p><b>Phone:</b> ${escapeHtml(phoneNorm)}</p>
          <p><b>Preferred:</b> ${escapeHtml(preferred)}</p>
          ${messageNorm ? `<p><b>Message:</b><br/>${escapeHtml(messageNorm).replace(/\n/g, "<br/>")}</p>` : ""}
          <hr/><p><b>Page:</b> ${escapeHtml(page)}</p>
          <p><a href="${crmLink}">Open in CRM</a></p>`,
        replyTo: emailNorm,
      });
      emailOk = true;
      await prisma.lead.update({ where: { id: lead.id }, data: { emailNotified: true } });
    } catch (e) { console.error("Email error:", e); }

    if (!tgOk && !emailOk) {
      // Both channels failed: the lead is safely stored but no one was pinged. Emit a
      // greppable marker so a log-based monitor can alert on it (audit item L4).
      console.error(`LEAD_NOTIFY_FAILED lead=${lead.id} email=${emailNorm} — Telegram AND email both failed; lead saved, no notification delivered`);
    }

    // Auto-reply to client (non-fatal)
    try {
      const { subject, html } = getAutoReplyEmail({ name: firstName, lang: langNorm });
      await transporter.sendMail({ from: `"Cyprus VIP Estates" <office@cyprusvipestates.com>`, to: emailNorm, subject, html });
    } catch (e) { console.error("Auto-reply error:", e); }

    return NextResponse.json({ ok: true, created: true, id: lead.id }, { status: 200 });
  } catch (err) {
    console.error("Lead capture error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
