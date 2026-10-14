import { NextResponse } from "next/server";
import { isGuideId, isGuideLang } from "@/lib/guides/registry";
import { verifyGuideToken } from "@/lib/guides/token";
import { readGuidePdf } from "@/lib/guides/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lead-magnet PDF download. Only reachable with the signed link returned by /api/leads (and e-mailed to the visitor). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") ?? "";
  const token = url.searchParams.get("t");

  if (!isGuideId(params.id) || !isGuideLang(lang)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let valid = false;
  try { valid = verifyGuideToken(params.id, lang, token); } catch (e) { console.error("guide token config error:", e); return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
  if (!valid) return NextResponse.json({ error: "link_expired_or_invalid" }, { status: 403 });

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
