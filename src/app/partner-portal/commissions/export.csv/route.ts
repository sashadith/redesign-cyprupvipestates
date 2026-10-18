import { cookies, headers } from "next/headers";
import { commissionsCsv } from "@/lib/partner/commissionsCsv";
import { csvFilename, parsePeriod, toCsvRows } from "@/lib/partner/commissions";
import { PARTNER_LANG_COOKIE, pickPartnerLocale } from "@/lib/partner/i18n";
import { myCommissions } from "@/lib/partner/scope";
import { partnerForRoute } from "../../routeAuth";

// CSV export of the partner's commissions (phase 3c, Decision 6): same scope function and period as
// the page, rows built from the DTO only. Partner host: /commissions/export.csv?period=|from=&to=.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await partnerForRoute({ active: true });
  if (me instanceof Response) return me;
  const sp = new URL(req.url).searchParams;
  const period = parsePeriod({ period: sp.get("period"), from: sp.get("from"), to: sp.get("to") });
  const data = await myCommissions(me.partner.id, period);
  const locale = pickPartnerLocale({
    partnerLanguage: me.partner.language,
    cookie: cookies().get(PARTNER_LANG_COOKIE)?.value,
    acceptLanguage: headers().get("accept-language"),
  });
  return new Response(commissionsCsv(toCsvRows(data.rows), locale), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(period)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
