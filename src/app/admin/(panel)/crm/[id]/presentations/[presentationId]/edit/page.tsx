import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildEditorItems } from "@/lib/crm/presentations/editorItems";
import { listPresentationLocations } from "../../../presentationActions";
import PresentationEditor, { type EditorItem } from "./PresentationEditor";
import type { MatchFilters } from "@/lib/crm/matching";

export const dynamic = "force-dynamic";

export default async function EditPresentationPage({ params }: { params: { id: string; presentationId: string } }) {
  const presentation = await prisma.clientPresentation.findFirst({
    where: { id: params.presentationId, leadId: params.id },
    include: { items: { orderBy: { sortIndex: "asc" } } },
  });
  if (!presentation) notFound();

  const [users, locations, lead] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listPresentationLocations(),
    prisma.lead.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { budgetMin: true, budgetMax: true, propertyTypeInterest: true, lastMatchFilters: true },
    }),
  ]);
  if (!lead) notFound();

  const items: EditorItem[] = await buildEditorItems(presentation.items);

  return (
    <div className="max-w-5xl">
      <Link href={`/admin/crm/${params.id}`} className="text-sm text-[#1B4B43] hover:underline">← Back to lead</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Edit Client Presentation</h1>
      <p className="text-xs text-[#9CA3AF] mb-6">Token: {presentation.token} — same link, changes apply in place.</p>

      <PresentationEditor
        leadId={params.id}
        presentationId={presentation.id}
        token={presentation.token}
        general={{
          greetingName: presentation.greetingName,
          locale: presentation.locale,
          personalNote: presentation.personalNote ?? "",
          advisorId: presentation.advisorId ?? "",
          expiresAt: presentation.expiresAt ? presentation.expiresAt.toISOString().slice(0, 10) : "",
        }}
        items={items}
        users={users}
        locations={locations}
        initialCriteria={(presentation.criteria as MatchFilters | null) ?? null}
        lead={{
          budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
          propertyTypeInterest: lead.propertyTypeInterest,
          lastMatchFilters: lead.lastMatchFilters as any,
        }}
      />
    </div>
  );
}
