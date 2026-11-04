import { prisma } from "@/lib/prisma";
import { creditNoteFilename } from "@/lib/crm/payoutRules";
import { creditNoteWhere } from "@/lib/partner/commissions";
import { notFoundResponse, partnerForRoute } from "../../../routeAuth";

// Partner download of their own credit note (phase 3c, Decision 7). Another partner's id, an unknown
// id and a malformed id all answer the same 404, so the route never confirms that a note exists.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await partnerForRoute({ active: true });
  if (me instanceof Response) return me;
  const id = params.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return notFoundResponse();
  const note = await prisma.creditNote.findFirst({ where: creditNoteWhere(me.partner.id, id), select: { number: true, pdf: true } });
  if (!note) return notFoundResponse();
  return new Response(new Uint8Array(note.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${creditNoteFilename(note.number)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
