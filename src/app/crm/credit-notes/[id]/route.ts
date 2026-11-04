import { prisma } from "@/lib/prisma";
import { getCrmUser } from "@/lib/crm/session";
import { isIdArg } from "@/lib/crm/commissionActions";
import { canDownloadCreditNote, creditNoteFilename } from "@/lib/crm/payoutRules";

// Staff download of an issued credit note (partner portal phase 3c, Decision 7):
// managers, or anyone who may see the deal's lead. Everything else is a 404, so
// the route never confirms that a credit-note id exists.

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCrmUser();
  if (!user || !isIdArg(params.id)) return notFound();
  const note = await prisma.creditNote.findUnique({
    where: { id: params.id },
    select: { number: true, pdf: true, deal: { select: { lead: { select: { assignedToId: true } } } } },
  });
  if (!note || !canDownloadCreditNote(user, note.deal.lead)) return notFound();
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
