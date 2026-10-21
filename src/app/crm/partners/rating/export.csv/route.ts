// CSV of one rating season's full ranking (names, companies, points by kind). Managers only; anything
// else is a 404 so the route never confirms that a season id exists.
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";
import { ratingCsv, ratingCsvFilename } from "@/lib/partner/ratingFlow";
import { crmSeasonRanking } from "@/lib/partner/ratingStore";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(req: Request) {
  const user = await getCrmUser();
  if (!user || !canAssignLeads(user)) return notFound();
  const id = new URL(req.url).searchParams.get("season") ?? "";
  if (!id || id.length > 64) return notFound();
  const season = await prisma.ratingSeason.findUnique({ where: { id }, select: { id: true, name: true, startsAt: true } });
  if (!season) return notFound();
  const rows = await crmSeasonRanking(season.id);
  return new Response(ratingCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ratingCsvFilename(season.name, season.startsAt)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
