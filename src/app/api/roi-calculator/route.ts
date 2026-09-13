import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { parseAttribution } from "@/lib/attribution";
import { recordInboundLead } from "@/lib/leadNotify";
import { safeUrl, allowedHost, escapeHtml, blocked, guardRequest, spamSignal, makeRateLimiter } from "@/lib/antispam";
import { HE_LANGUAGE_NOTE, LOCALES, type Locale } from "@/lib/locale";
import { stripHtmlToText } from "@/lib/emailSignature/sanitize";

const LEAD_LOCALES = new Set<string>(LOCALES);

const ipLimiter = makeRateLimiter();
const emailLimiter = makeRateLimiter();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: Number(process.env.EMAIL_PORT || 465),
  secure: String(process.env.EMAIL_SECURE || "true") === "true",
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASSWORD!,
  },
});

type Lang = Locale;

// One `Record<Locale, …>` table for everything this route renders per locale
// (Hebrew Localization Phase 4, WP7). It replaces five `lang === "pl" ? … : …`
// ternary chains (two Intl tags, three scenario labels, the no-name
// fallback) AND absorbs the five result-table labels in the client e-mail
// body, which used to be hard-coded English for every locale — they are
// carried over verbatim into en/de/pl/ru here, so the LTR HTML is
// byte-identical to before and only `he` renders anything new.
type RoiEmailCopy = {
  /** BCP-47 tag for Intl.NumberFormat — a format tag, not translated copy. */
  numberLocale: string;
  strategyBuySell: string;
  strategyBuyHold: string;
  scenarioConservative: string;
  scenarioOptimistic: string;
  scenarioRealistic: string;
  /** Greeting fallback when the form carried no usable name. */
  safeName: string;
  /** The complete first line, name already interpolated and HTML-escaped.
   *  `${safeName},` alone rendered a bare Hebrew first name plus a comma,
   *  which is not a salutation in Hebrew (Pass B Must fix #9). */
  greetingLine: (name: string) => string;
  /** Entscheidung E — `he` only, empty everywhere else. The ROI result mail
   *  is automated and goes out before any human contact (Must fix #3). */
  languageNote: string;
  labelStrategy: string;
  labelScenario: string;
  labelTotalEntryCost: string;
  labelProjectedResult: string;
  labelAnnualRoi: string;
  subject: string;
  title: string;
  intro: string;
  summary: string;
  cta: string;
  footer: string;
};

const ROI_EMAIL_EN: RoiEmailCopy = {
  numberLocale: "en-US",
  strategyBuySell: "Buy & Sell",
  strategyBuyHold: "Buy & Hold",
  scenarioConservative: "Conservative",
  scenarioOptimistic: "Optimistic",
  scenarioRealistic: "Realistic",
  safeName: "Dear Client",
  greetingLine: (n) => `${escapeHtml(n || "Dear Client")},`,
  languageNote: "",
  labelStrategy: "Strategy",
  labelScenario: "Scenario",
  labelTotalEntryCost: "Total entry cost",
  labelProjectedResult: "Projected result",
  labelAnnualRoi: "Average annual ROI",
  subject: "Your ROI calculation — Cyprus VIP Estates",
  title: "Your indicative ROI result",
  intro:
    "Thank you for using the ROI Calculator on Cyprus VIP Estates.",
  summary: "Below is a summary of your projected investment result.",
  cta: "View property",
  footer:
    "This calculation is indicative only. Final figures may vary depending on the property, transaction structure and market conditions.",
};

const ROI_EMAIL: Record<Locale, RoiEmailCopy> = {
  en: ROI_EMAIL_EN,
  ru: {
    numberLocale: "ru-RU",
    strategyBuySell: "Buy & Sell",
    strategyBuyHold: "Buy & Hold",
    scenarioConservative: "Консервативный",
    scenarioOptimistic: "Оптимистичный",
    scenarioRealistic: "Реалистичный",
    safeName: "Уважаемый клиент",
    greetingLine: (n) => `${escapeHtml(n || "Уважаемый клиент")},`,
    languageNote: "",
    labelStrategy: "Strategy",
    labelScenario: "Scenario",
    labelTotalEntryCost: "Total entry cost",
    labelProjectedResult: "Projected result",
    labelAnnualRoi: "Average annual ROI",
    subject: "Ваш расчет ROI — Cyprus VIP Estates",
    title: "Ваш ориентировочный расчет ROI",
    intro:
      "Спасибо за использование ROI Calculator на сайте Cyprus VIP Estates.",
    summary: "Мы сохранили основные результаты вашего расчета ниже.",
    cta: "Перейти к объекту",
    footer:
      "Расчет носит ориентировочный характер. Финальные показатели могут отличаться в зависимости от объекта, структуры сделки и рыночных условий.",
  },
  pl: {
    numberLocale: "pl-PL",
    strategyBuySell: "Buy & Sell",
    strategyBuyHold: "Buy & Hold",
    scenarioConservative: "Konserwatywny",
    scenarioOptimistic: "Optymistyczny",
    scenarioRealistic: "Realistyczny",
    safeName: "Szanowny Kliencie",
    greetingLine: (n) => `${escapeHtml(n || "Szanowny Kliencie")},`,
    languageNote: "",
    labelStrategy: "Strategy",
    labelScenario: "Scenario",
    labelTotalEntryCost: "Total entry cost",
    labelProjectedResult: "Projected result",
    labelAnnualRoi: "Average annual ROI",
    subject: "Twój wynik ROI — Cyprus VIP Estates",
    title: "Twój orientacyjny wynik ROI",
    intro:
      "Dziękujemy za skorzystanie z kalkulatora ROI na stronie Cyprus VIP Estates.",
    summary: "Poniżej znajdziesz główne wyniki swojej kalkulacji.",
    cta: "Przejdź do oferty",
    footer:
      "Kalkulacja ma charakter orientacyjny. Ostateczne wyniki mogą się różnić w zależności od nieruchomości, struktury transakcji i warunków rynkowych.",
  },
  de: {
    numberLocale: "de-DE",
    strategyBuySell: "Buy & Sell",
    strategyBuyHold: "Buy & Hold",
    scenarioConservative: "Konservativ",
    scenarioOptimistic: "Optimistisch",
    scenarioRealistic: "Realistisch",
    safeName: "Sehr geehrte Kundin, sehr geehrter Kunde",
    greetingLine: (n) => `${escapeHtml(n || "Sehr geehrte Kundin, sehr geehrter Kunde")},`,
    languageNote: "",
    labelStrategy: "Strategy",
    labelScenario: "Scenario",
    labelTotalEntryCost: "Total entry cost",
    labelProjectedResult: "Projected result",
    labelAnnualRoi: "Average annual ROI",
    subject: "Ihre ROI-Berechnung — Cyprus VIP Estates",
    title: "Ihr unverbindliches ROI-Ergebnis",
    intro:
      "Vielen Dank, dass Sie den ROI-Rechner von Cyprus VIP Estates genutzt haben.",
    summary:
      "Nachfolgend finden Sie die wichtigsten Ergebnisse Ihrer Berechnung.",
    cta: "Zum Objekt",
    footer:
      "Diese Berechnung ist indikativ. Die endgültigen Ergebnisse können je nach Immobilie, Transaktionsstruktur und Marktbedingungen abweichen.",
  },
  // `numberLocale` stays "en-US": Hebrew uses Western digits and `€` before
  // the amount (styleguide §5), which is exactly what en-US produces — the
  // he-IL tag would move the symbol behind the number. `|` replaces the em
  // dash of the LTR subjects (§3: no `—` in Hebrew).
  he: {
    numberLocale: "en-US",
    strategyBuySell: "רכישה ומכירה",
    strategyBuyHold: "רכישה והחזקה",
    scenarioConservative: "שמרני",
    scenarioOptimistic: "אופטימי",
    scenarioRealistic: "ריאלי",
    safeName: "שלום",
    // Named form = the same greeting plus the name, matching every other
    // Hebrew message in the CRM (§11.6); the Latin name is <bdi>-wrapped.
    greetingLine: (n) => (n ? `שלום <bdi>${escapeHtml(n)}</bdi>,` : "שלום,"),
    languageNote: HE_LANGUAGE_NOTE,
    labelStrategy: "אסטרטגיה",
    labelScenario: "תרחיש",
    labelTotalEntryCost: "עלות כניסה כוללת",
    labelProjectedResult: "תוצאה צפויה",
    labelAnnualRoi: "תשואה שנתית ממוצעת",
    subject: "חישוב התשואה שלכם | Cyprus VIP Estates",
    title: "התשואה המשוערת שלכם",
    intro: "תודה שהשתמשתם במחשבון התשואה של Cyprus VIP Estates.",
    summary: "לפניכם סיכום התוצאה הצפויה של ההשקעה.",
    cta: "לצפייה בנכס",
    footer:
      "החישוב משוער בלבד. הנתונים הסופיים עשויים להשתנות בהתאם לנכס, למבנה העסקה ולתנאי השוק.",
  }, // REVIEW(he)
};

/** Resolves whatever the form sent as `lang` to a copy row; junk falls back to en. */
function roiEmailCopy(lang: unknown): RoiEmailCopy {
  return ROI_EMAIL[LOCALES.includes(lang as Locale) ? (lang as Locale) : "en"];
}

function formatCurrency(value: number, lang: Lang) {
  return new Intl.NumberFormat(roiEmailCopy(lang).numberLocale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, lang: Lang) {
  return new Intl.NumberFormat(roiEmailCopy(lang).numberLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function getStrategyLabel(strategy: string, lang: Lang) {
  const t = roiEmailCopy(lang);
  return strategy === "buySell" ? t.strategyBuySell : t.strategyBuyHold;
}

function getScenarioLabel(scenario: string, lang: Lang) {
  const t = roiEmailCopy(lang);
  switch (scenario) {
    case "conservative":
      return t.scenarioConservative;
    case "optimistic":
      return t.scenarioOptimistic;
    default:
      return t.scenarioRealistic;
  }
}

function getInternalEmailHtml(payload: any) {
  const {
    name,
    email,
    phone,
    lang,
    currentPage,
    strategy,
    scenario,
    inputs,
    result,
  } = payload;

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || "");
  const safePage = escapeHtml(currentPage || "");

  return `
    <h2>ROI Calculator Submission — Cyprus VIP Estates</h2>

    <p><strong>Name:</strong> ${safeName}</p>
    <p><strong>Email:</strong> ${safeEmail}</p>
    ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ""}
    <p><strong>Language:</strong> ${escapeHtml(lang)}</p>
    <p><strong>Page:</strong> ${safePage}</p>

    <hr/>

    <p><strong>Strategy:</strong> ${escapeHtml(getStrategyLabel(strategy, lang))}</p>
    <p><strong>Scenario:</strong> ${escapeHtml(getScenarioLabel(scenario, lang))}</p>

    <h3>Input values</h3>
    <ul>
      <li><strong>Property price:</strong> ${formatCurrency(inputs.purchasePrice, lang)}</li>
      <li><strong>Furnishing cost:</strong> ${formatCurrency(inputs.furnishingCost, lang)}</li>
      <li><strong>Build period:</strong> ${escapeHtml(String(inputs.buildPeriodYears))} years</li>
      <li><strong>Annual off-plan growth:</strong> ${formatPercent(inputs.offPlanGrowth * 100, lang)}%</li>
      <li><strong>Selling costs:</strong> ${formatPercent(inputs.sellingCostsPercent * 100, lang)}%</li>
      ${
        strategy === "buyHold"
          ? `
            <li><strong>Net yield (year 1):</strong> ${formatPercent(inputs.netYieldYearOne * 100, lang)}%</li>
            <li><strong>Annual rent growth:</strong> ${formatPercent(inputs.annualRentGrowth * 100, lang)}%</li>
            <li><strong>Rental period after completion:</strong> ${escapeHtml(String(inputs.rentalPeriodYears))} years</li>
            <li><strong>Annual appreciation:</strong> ${formatPercent(inputs.annualAppreciation * 100, lang)}%</li>
          `
          : ""
      }
    </ul>

    <h3>Result</h3>
    <ul>
      <li><strong>Purchase cost with fees:</strong> ${formatCurrency(result.purchaseCostWithFees, lang)}</li>
      <li><strong>Total entry cost:</strong> ${formatCurrency(result.totalEntryCost, lang)}</li>
      <li><strong>Future sale price:</strong> ${formatCurrency(result.futureSalePrice, lang)}</li>
      <li><strong>Selling costs:</strong> ${formatCurrency(result.sellingCosts, lang)}</li>
      <li><strong>Net profit / total return:</strong> ${formatCurrency(result.netProfit, lang)}</li>
      <li><strong>Total ROI:</strong> ${formatPercent(result.roiPercent, lang)}%</li>
      <li><strong>Average annual ROI:</strong> ${formatPercent(result.annualizedRoiPercent, lang)}%</li>
    </ul>
  `;
}

function getClientEmail(payload: any) {
  const { name, lang, strategy, scenario, currentPage, result } = payload;

  const safeLang: Locale = LOCALES.includes(lang) ? lang : "en";
  const t = ROI_EMAIL[safeLang];

  const greetingLine = t.greetingLine(String(name ?? "").trim());

  const strategyLabel = getStrategyLabel(strategy, lang);
  const scenarioLabel = getScenarioLabel(scenario, lang);

  // RTL support for `he` (Phase 4 / WP7, corrected in fix round 1).
  // `dir` on <html>/<body> alone does nothing in Gmail, Yahoo and
  // Outlook.com — they discard both tags and re-host the markup in their own
  // LTR container (Pass B Must fix #2). It therefore also sits on both
  // wrapper tables, on the result table, on every text cell and on every <p>,
  // each with an inline text-align that survives HTML sanitizers. All of
  // these are the empty string for an LTR locale, so en/de/pl/ru render
  // byte-identical HTML (locked by emailTemplatesRtl.test.ts).
  const rtl = safeLang === "he";
  const dirAttr = rtl ? ` dir="rtl"` : "";
  const textAlign = rtl ? "right" : "left";
  const cellAlign = rtl ? " text-align:right;" : "";
  const valueAlign = rtl ? "left" : "right";

  const link =
    safeUrl(currentPage)?.toString() || "https://cyprusvipestates.com";

  const html = `
  <!DOCTYPE html>
  <html lang="${safeLang}"${dirAttr}>
  <head>
    <meta charset="UTF-8" />
    <title>${t.subject}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,Helvetica,sans-serif;"${dirAttr}>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"${dirAttr} style="background-color:#f4f4f4; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"${dirAttr} style="max-width:600px; background-color:#ffffff; overflow:hidden;">
            <tr>
              <td align="center" style="padding:24px 24px 8px 24px;">
                <img
                  src="https://cyprusvipestates.com/uploads/images/c4911e6ba6654becbeda47f9485754fbcfeb407e-500x634.png"
                  alt="Cyprus VIP Estates"
                  width="80"
                  style="display:block; height:auto;"
                />
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 24px 0 24px;">
                <h1 style="margin:0; font-size:22px; line-height:1.4; font-weight:400; color:#111111;">
                  ${t.title}
                </h1>
              </td>
            </tr>

            <tr>
              <td align="${textAlign}"${dirAttr} style="padding:16px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;${cellAlign}">
                <p${rtl ? ` dir="rtl" style="margin:0 0 12px 0; text-align:right;"` : ' style="margin:0 0 12px 0;"'}>${greetingLine}</p>
                <p${rtl ? ` dir="rtl" style="margin:0 0 8px 0; text-align:right;"` : ' style="margin:0 0 8px 0;"'}>${t.intro}</p>
                <p${rtl ? ` dir="rtl" style="margin:0 0 12px 0; text-align:right;"` : ' style="margin:0 0 12px 0;"'}>${t.summary}</p>${t.languageNote ? `
                <p dir="rtl" style="margin:0 0 12px 0; text-align:right;">${t.languageNote}</p>` : ""}
              </td>
            </tr>

            <tr>
              <td style="padding:8px 32px 0 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"${dirAttr} style="border-collapse:collapse; border:1px solid #ecefee;">
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">${t.labelStrategy}</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:${valueAlign}; color:#0d3f43;"><strong>${escapeHtml(strategyLabel)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">${t.labelScenario}</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:${valueAlign}; color:#0d3f43;"><strong>${escapeHtml(scenarioLabel)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">${t.labelTotalEntryCost}</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:${valueAlign}; color:#0d3f43;"><strong>${formatCurrency(result.totalEntryCost, lang)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">${t.labelProjectedResult}</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:${valueAlign}; color:#0d3f43;"><strong>${formatCurrency(result.netProfit, lang)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; color:#526264;">${t.labelAnnualRoi}</td>
                    <td style="padding:14px 16px; text-align:${valueAlign}; color:#0d3f43;"><strong>${formatPercent(result.annualizedRoiPercent, lang)}%</strong></td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 32px;">
                <a href="${escapeHtml(link)}"
                  target="_blank"
                  style="
                    display:inline-block;
                    padding:12px 28px;
                    background-color:#bd8948;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:14px;
                    border-radius:4px;
                    font-weight:400;
                  ">
                  ${t.cta}
                </a>
              </td>
            </tr>

            <tr>
              <td align="center"${dirAttr} style="padding:0 24px 16px 24px; color:#aaaaaa; font-size:11px; line-height:1.5;">
                <p${rtl ? ` dir="rtl" style="margin:0; text-align:center;"` : ' style="margin:0;"'}>
                  ${t.footer}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return {
    subject: t.subject,
    html,
  };
}

export async function POST(request: Request) {
  try {
    // Anti-spam guards (mirror /api/leads): the ROI form sends fax (honeypot),
    // formStartTime, currentPage and lang, so we can vet requests cheaply here.
    const guard = guardRequest(request, ipLimiter);
    if (guard) return guard;
    const referer = request.headers.get("referer") || "";

    const body = await request.json();

    const {
      name,
      email,
      phone,
      lang,
      currentPage,
      strategy,
      scenario,
      inputs,
      result,
    } = body;

    const emailNorm = String(email ?? "")
      .trim()
      .toLowerCase();
    const nameNorm = String(name ?? "").trim();
    const phoneNorm = String(phone ?? "").trim();
    const currentPageNorm = String(currentPage ?? "").trim();

    if (
      !nameNorm ||
      !emailNorm ||
      !strategy ||
      !scenario ||
      !inputs ||
      !result
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email" },
        { status: 400 },
      );
    }

    if (!currentPageNorm || !allowedHost(currentPageNorm)) {
      return NextResponse.json(
        { ok: false, error: "Invalid page URL" },
        { status: 400 },
      );
    }

    // referer host must match the submitted page host
    const refUrl = safeUrl(referer);
    const pageUrl = safeUrl(currentPageNorm);
    if (!refUrl || !pageUrl || refUrl.hostname !== pageUrl.hostname) return blocked("page_mismatch");

    // Honeypot + timing + per-email rate limit
    const spam = spamSignal(body);
    if (spam) return blocked(spam);
    if (emailLimiter(emailNorm, 3, 60_000)) return blocked("rate_limit_email");

    // Persist to the CRM first (system of record); emails are notifications.
    let leadId: string | null = null;
    try {
      const roiPct =
        result && typeof result.annualizedRoiPercent === "number"
          ? `${result.annualizedRoiPercent}% avg annual ROI`
          : "";
      const lead = await prisma.lead.create({
        data: {
          firstName: nameNorm,
          lastName: String(body.surname ?? "").trim() || "",
          email: emailNorm,
          phone: phoneNorm || null,
          source: "ROI_CALCULATOR",
          status: "NEW",
          notes: `ROI calculator: ${String(strategy)} / ${String(scenario)}${roiPct ? ` · ~${roiPct}` : ""}`,
          languagePreference: LEAD_LOCALES.has(String(lang ?? "").toLowerCase())
            ? (String(lang).toLowerCase() as any)
            : null,
          pageSource: currentPageNorm,
          ...parseAttribution(body),
        },
      });
      leadId = lead.id;
      await recordInboundLead({ leadId, source: "ROI_CALCULATOR", email: emailNorm, name: nameNorm, phone: phoneNorm, page: currentPageNorm });
    } catch (e) {
      console.error("ROI lead persist error:", e);
    }

    // Email notifications (best-effort — the lead is already persisted above).
    try {
      const internalHtml = getInternalEmailHtml({
        name: nameNorm,
        email: emailNorm,
        phone: phoneNorm,
        lang,
        currentPage: currentPageNorm,
        strategy,
        scenario,
        inputs,
        result,
      });
      await transporter.sendMail({
        from: `"Cyprus VIP Estates" <${process.env.EMAIL_USER!}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER!,
        cc: process.env.EMAIL_COFOUNDER || undefined,
        subject: "ROI Calculator Submission — Cyprus VIP Estates",
        // A text/plain alternative on every transactional mail: SpamAssassin
        // penalises HTML-only (MIME_HTML_ONLY), and for `he` a text part is
        // the most reliable RTL fallback because the client renders it in its
        // own reading direction (Pass B Should fix #22 / Systemic S-E).
        text: stripHtmlToText(internalHtml),
        html: internalHtml,
        replyTo: emailNorm,
      });
      if (leadId) { try { await prisma.lead.update({ where: { id: leadId }, data: { emailNotified: true } }); } catch {} }
    } catch (err: any) {
      console.error("ROI internal email error:", err);
    }

    try {
      const { subject, html: clientHtml } = getClientEmail({
        name: nameNorm,
        lang,
        currentPage: currentPageNorm,
        strategy,
        scenario,
        result,
      });

      await transporter.sendMail({
        from: `"Cyprus VIP Estates" <${process.env.EMAIL_USER!}>`,
        to: emailNorm,
        subject,
        text: stripHtmlToText(clientHtml),
        html: clientHtml,
      });
    } catch (err: any) {
      console.error("ROI client email error:", err);
    }

    return NextResponse.json(
      { ok: true, message: "Emails sent successfully" },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("ROI route error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details:
          process.env.NODE_ENV !== "production"
            ? {
                message: err?.message,
                code: err?.code,
                command: err?.command,
              }
            : undefined,
      },
      { status: 500 },
    );
  }
}
