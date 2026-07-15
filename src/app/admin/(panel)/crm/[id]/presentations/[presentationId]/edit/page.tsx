import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDbProjectsByIds } from "@/lib/developmentRender";
import { normalizeRef } from "@/lib/unitRef";
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

  const devMap = await getDbProjectsByIds(presentation.items.map((i) => i.developmentId), "en");

  const items: EditorItem[] = presentation.items
    .map((it): EditorItem | null => {
      const vm = devMap[it.developmentId];
      if (!vm) return null;
      const unitRefs = Array.isArray(it.unitRefs) ? (it.unitRefs as string[]) : null;
      const unitIds = Array.isArray(it.unitIds) ? (it.unitIds as string[]) : null;
      const units = vm.units.map((u) => ({
        id: u.id ?? "", ref: u.ref, label: u.label, type: u.type, beds: u.beds,
        areaBuilt: u.areaBuilt, price: u.price, currency: u.currency, status: u.status,
      }));
      const availableIds = units.filter((u) => u.status === "available").map((u) => u.id);
      // Same resolution as the public page (src/app/c/[token]/page.tsx) — null
      // unitRefs/unitIds means "whole project", i.e. every available unit checked.
      let checkedUnitIds: string[];
      if (unitRefs && unitRefs.length) {
        const matched = units.filter((u) => (u.ref && u.ref.trim() ? unitRefs.includes(normalizeRef(u.ref, vm.publicName)) : !!unitIds?.includes(u.id)));
        checkedUnitIds = matched.length ? matched.map((u) => u.id) : availableIds;
      } else if (unitIds && unitIds.length) {
        checkedUnitIds = units.filter((u) => unitIds.includes(u.id)).map((u) => u.id);
      } else {
        checkedUnitIds = availableIds;
      }
      return {
        developmentId: it.developmentId,
        publicName: vm.publicName,
        mainImage: vm.gallery[0] ?? null,
        district: vm.district || null,
        area: vm.area || null,
        town: vm.town || null,
        priceFrom: vm.priceFrom ?? null,
        currency: vm.currency || "EUR",
        aliasName: it.aliasName ?? "",
        advisorComment: it.advisorComment ?? "",
        sortIndex: it.sortIndex,
        isNew: it.isNew,
        units,
        checkedUnitIds,
      };
    })
    .filter((x): x is EditorItem => x !== null);

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
