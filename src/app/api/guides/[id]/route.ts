import { NextResponse } from "next/server";
import { isGuideId, isGuideLang, guideLangFor } from "@/lib/guides/registry";
import { verifyGuideToken } from "@/lib/guides/token";
import { readGuidePdf } from "@/lib/guides/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRED: Record<string, { title: string; text: string; link: string }> = {
  en: { title: "This download link has expired", text: "Download links work for 30 days. Request the guide again on the article page and we will send a fresh link.", link: "Back to cyprusvipestates.com" },
  de: { title: "Dieser Download-Link ist abgelaufen", text: "Download-Links sind 30 Tage gültig. Fordern Sie den Ratgeber auf der Artikelseite erneut an, dann senden wir Ihnen einen neuen Link.", link: "Zurück zu cyprusvipestates.com" },
  pl: { title: "Ten link do pobrania wygasł", text: "Linki do pobrania działają przez 30 dni. Poproś o przewodnik ponownie na stronie artykułu, a wyślemy nowy link.", link: "Wróć na cyprusvipestates.com" },
  ru: { title: "Срок действия ссылки истёк", text: "Ссылки на скачивание действуют 30 дней. Запросите гайд ещё раз на странице статьи, и мы пришлём новую ссылку.", link: "Вернуться на cyprusvipestates.com" },
};

function expiredPage(lang: string): NextResponse {
  const t = EXPIRED[guideLangFor(lang)];
  const html = `<!doctype html><html lang="${guideLangFor(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${t.title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f6f1e8;color:#221c15"><main style="max-width:520px;margin:12vh auto;padding:0 24px"><h1 style="font-size:24px;font-weight:600">${t.title}</h1><p style="line-height:1.6">${t.text}</p><p><a href="https://cyprusvipestates.com/" style="color:#9a6d2f">${t.link}</a></p></main></body></html>`;
  return new NextResponse(html, { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

/** Lead-magnet PDF download. Only reachable with the signed link returned by /api/leads (and e-mailed to the visitor). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") ?? "";
  const token = url.searchParams.get("t");

  if (!isGuideId(params.id) || !isGuideLang(lang)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let valid = false;
  try { valid = verifyGuideToken(params.id, lang, token); } catch (e) { console.error("GUIDE_TOKEN_CONFIG_FAILED guide downloads are unavailable:", e); return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
  if (!valid) return expiredPage(lang);

  try {
    const buffer = readGuidePdf(params.id, lang);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cyprus-vip-estates-${params.id}-${lang}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    console.error("guide pdf read failed:", params.id, lang, e);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
