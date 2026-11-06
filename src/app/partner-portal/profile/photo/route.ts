import { prisma } from "@/lib/prisma";
import { notFoundResponse, partnerForRoute } from "../../routeAuth";

// Phase 3e: the signed-in partner's own brand photo (profile preview). Partner host: /profile/photo.
// Same stored bytes and sniffed type the public /c/[token]/photo route serves; never another partner's.

export const dynamic = "force-dynamic";

const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET() {
  const me = await partnerForRoute({ active: true });
  if (me instanceof Response) return me;
  const p = await prisma.partner.findUnique({ where: { id: me.partner.id }, select: { brandPhoto: true, brandPhotoType: true } });
  if (!p?.brandPhoto || !p.brandPhoto.length || !TYPES.has(p.brandPhotoType ?? "")) return notFoundResponse();
  return new Response(new Uint8Array(p.brandPhoto), {
    status: 200,
    headers: { "Content-Type": p.brandPhotoType as string, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
