import { prisma } from "@/lib/prisma";
import { LOGO_HEADERS, logoDecision } from "@/lib/partner/presentationBranding";

// Partner logo on a partner-branded presentation (partner portal phase 3e, Decision 7). Served only for an
// active, unexpired presentation of an ACTIVE partner with a stored logo; the Content-Type is the type sniffed
// from the bytes at upload (never the browser's claim). Everything else is a plain 404.

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = typeof params.token === "string" ? params.token : "";
  if (!token || token.length > 64) return notFound();
  const row = await prisma.clientPresentation.findUnique({
    where: { token },
    select: { status: true, expiresAt: true, partnerId: true, partner: { select: { status: true, brandLogo: true, brandLogoType: true } } },
  });
  const d = logoDecision(row, new Date());
  if (!d.ok) return notFound();
  return new Response(new Uint8Array(d.bytes), { status: 200, headers: { "Content-Type": d.type, ...LOGO_HEADERS } });
}
