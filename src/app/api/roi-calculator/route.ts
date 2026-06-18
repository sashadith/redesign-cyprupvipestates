import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const ALLOWED_HOSTS = new Set([
  "cyprusvipestates.com",
  "www.cyprusvipestates.com",
  "localhost",
]);

function safeUrl(raw: string) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isAllowedHostFromUrl(raw: string) {
  const u = safeUrl(raw);
  if (!u) return false;
  return ALLOWED_HOSTS.has(u.hostname);
}

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: Number(process.env.EMAIL_PORT || 465),
  secure: String(process.env.EMAIL_SECURE || "true") === "true",
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASSWORD!,
  },
});

type Lang = "en" | "ru" | "pl" | "de" | string;

function formatCurrency(value: number, lang: Lang) {
  const locale =
    lang === "pl"
      ? "pl-PL"
      : lang === "de"
        ? "de-DE"
        : lang === "ru"
          ? "ru-RU"
          : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, lang: Lang) {
  const locale =
    lang === "pl"
      ? "pl-PL"
      : lang === "de"
        ? "de-DE"
        : lang === "ru"
          ? "ru-RU"
          : "en-US";

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function getStrategyLabel(strategy: string, lang: Lang) {
  if (strategy === "buySell") {
    return "Buy & Sell";
  }
  return "Buy & Hold";
}

function getScenarioLabel(scenario: string, lang: Lang) {
  switch (scenario) {
    case "conservative":
      return lang === "pl"
        ? "Konserwatywny"
        : lang === "de"
          ? "Konservativ"
          : lang === "ru"
            ? "Консервативный"
            : "Conservative";
    case "optimistic":
      return lang === "pl"
        ? "Optymistyczny"
        : lang === "de"
          ? "Optimistisch"
          : lang === "ru"
            ? "Оптимистичный"
            : "Optimistic";
    default:
      return lang === "pl"
        ? "Realistyczny"
        : lang === "de"
          ? "Realistisch"
          : lang === "ru"
            ? "Реалистичный"
            : "Realistic";
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

  const safeName =
    (name && String(name).trim()) ||
    (lang === "ru"
      ? "Уважаемый клиент"
      : lang === "pl"
        ? "Szanowny Kliencie"
        : lang === "de"
          ? "Sehr geehrte Kundin, sehr geehrter Kunde"
          : "Dear Client");

  const strategyLabel = getStrategyLabel(strategy, lang);
  const scenarioLabel = getScenarioLabel(scenario, lang);

  const t = (() => {
    switch (lang) {
      case "ru":
        return {
          subject: "Ваш расчет ROI — Cyprus VIP Estates",
          title: "Ваш ориентировочный расчет ROI",
          intro:
            "Спасибо за использование ROI Calculator на сайте Cyprus VIP Estates.",
          summary: "Мы сохранили основные результаты вашего расчета ниже.",
          cta: "Перейти к объекту",
          footer:
            "Расчет носит ориентировочный характер. Финальные показатели могут отличаться в зависимости от объекта, структуры сделки и рыночных условий.",
        };
      case "pl":
        return {
          subject: "Twój wynik ROI — Cyprus VIP Estates",
          title: "Twój orientacyjny wynik ROI",
          intro:
            "Dziękujemy za skorzystanie z kalkulatora ROI na stronie Cyprus VIP Estates.",
          summary: "Poniżej znajdziesz główne wyniki swojej kalkulacji.",
          cta: "Przejdź do oferty",
          footer:
            "Kalkulacja ma charakter orientacyjny. Ostateczne wyniki mogą się różnić w zależności od nieruchomości, struktury transakcji i warunków rynkowych.",
        };
      case "de":
        return {
          subject: "Ihre ROI-Berechnung — Cyprus VIP Estates",
          title: "Ihr unverbindliches ROI-Ergebnis",
          intro:
            "Vielen Dank, dass Sie den ROI-Rechner von Cyprus VIP Estates genutzt haben.",
          summary:
            "Nachfolgend finden Sie die wichtigsten Ergebnisse Ihrer Berechnung.",
          cta: "Zum Objekt",
          footer:
            "Diese Berechnung ist indikativ. Die endgültigen Ergebnisse können je nach Immobilie, Transaktionsstruktur und Marktbedingungen abweichen.",
        };
      default:
        return {
          subject: "Your ROI calculation — Cyprus VIP Estates",
          title: "Your indicative ROI result",
          intro:
            "Thank you for using the ROI Calculator on Cyprus VIP Estates.",
          summary: "Below is a summary of your projected investment result.",
          cta: "View property",
          footer:
            "This calculation is indicative only. Final figures may vary depending on the property, transaction structure and market conditions.",
        };
    }
  })();

  const link =
    safeUrl(currentPage)?.toString() || "https://cyprusvipestates.com";

  const html = `
  <!DOCTYPE html>
  <html lang="${lang || "en"}">
  <head>
    <meta charset="UTF-8" />
    <title>${t.subject}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; overflow:hidden;">
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
              <td align="left" style="padding:16px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;">
                <p style="margin:0 0 12px 0;">${escapeHtml(safeName)},</p>
                <p style="margin:0 0 8px 0;">${t.intro}</p>
                <p style="margin:0 0 12px 0;">${t.summary}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 32px 0 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border:1px solid #ecefee;">
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">Strategy</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:right; color:#0d3f43;"><strong>${escapeHtml(strategyLabel)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">Scenario</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:right; color:#0d3f43;"><strong>${escapeHtml(scenarioLabel)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">Total entry cost</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:right; color:#0d3f43;"><strong>${formatCurrency(result.totalEntryCost, lang)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; color:#526264;">Projected result</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #ecefee; text-align:right; color:#0d3f43;"><strong>${formatCurrency(result.netProfit, lang)}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; color:#526264;">Average annual ROI</td>
                    <td style="padding:14px 16px; text-align:right; color:#0d3f43;"><strong>${formatPercent(result.annualizedRoiPercent, lang)}%</strong></td>
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
              <td align="center" style="padding:0 24px 16px 24px; color:#aaaaaa; font-size:11px; line-height:1.5;">
                <p style="margin:0;">
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

    if (!currentPageNorm || !isAllowedHostFromUrl(currentPageNorm)) {
      return NextResponse.json(
        { ok: false, error: "Invalid page URL" },
        { status: 400 },
      );
    }

    await transporter.verify();

    try {
      await transporter.sendMail({
        from: `"Cyprus VIP Estates" <${process.env.EMAIL_USER!}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER!,
        cc: process.env.EMAIL_COFOUNDER || undefined,
        subject: "ROI Calculator Submission — Cyprus VIP Estates",
        html: getInternalEmailHtml({
          name: nameNorm,
          email: emailNorm,
          phone: phoneNorm,
          lang,
          currentPage: currentPageNorm,
          strategy,
          scenario,
          inputs,
          result,
        }),
        replyTo: emailNorm,
      });
    } catch (err: any) {
      console.error("ROI internal email error:", err);
      return NextResponse.json(
        {
          ok: false,
          error: "Internal email failed",
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

    try {
      const { subject, html } = getClientEmail({
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
        html,
      });
    } catch (err: any) {
      console.error("ROI client email error:", err);
      return NextResponse.json(
        {
          ok: false,
          error: "Client email failed",
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
