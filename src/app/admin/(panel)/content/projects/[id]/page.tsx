import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TranslationsPanel from "@/app/admin/TranslationsPanel";
import DeactivateControl from "../DeactivateControl";
import ProjectEditForm from "./ProjectEditForm";
import { utcToZonedInput } from "@/lib/tz";
import { localizedHref } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function EditProject({ params }: { params: { id: string } }) {
  const p = await prisma.project.findUnique({
    where: { id: params.id },
    include: { supersededByDevelopment: { select: { id: true, publicName: true, slug: true, publishStatus: true } } },
  });
  if (!p) notFound();
  const seo = (p.seo as any) ?? {};
  const showSupersededBanner = p.status === "PUBLISHED" && p.supersededByDevelopment?.publishStatus === "published";
  const hasConfirmedLink = !!p.supersededByDevelopment;
  const prefillTarget = p.supersededByDevelopment
    ? localizedHref(p.language, ["projects", p.supersededByDevelopment.slug ?? ""])
    : null;
  // ACTIVATE/DEACTIVATE cascades across every locale row of this same real
  // project (see toggleProjectActive/deactivateProjectWithRedirect) — the
  // dialog names them, so fetch the sibling locales here.
  const siblingLocales = p.translationGroupId
    ? (await prisma.project.findMany({ where: { translationGroupId: p.translationGroupId }, select: { language: true } })).map((r) => r.language)
    : [p.language];

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/projects" className="text-sm text-[#1B4B43] hover:underline">← Back to projects</Link>
      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <DeactivateControl projectId={p.id} status={p.status} hasConfirmedLink={hasConfirmedLink} prefillTarget={prefillTarget} locales={siblingLocales} />
      </div>
      <p className="text-sm text-[#6B7280] mb-6">{p.language.toUpperCase()} · /{p.slug} <span className="text-[#C29A5E]">(slug editable below)</span></p>
      {showSupersededBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <span className="text-sm text-amber-800">
            New version published —{" "}
            <Link href={`/admin/developments/${p.supersededByDevelopment!.id}`} className="underline hover:no-underline">
              {p.supersededByDevelopment!.publicName}
            </Link>{" "}
            is live. Deactivate this listing?
          </span>
          <DeactivateControl projectId={p.id} status={p.status} hasConfirmedLink={hasConfirmedLink} prefillTarget={prefillTarget} locales={siblingLocales} variant="banner" />
        </div>
      )}
      <TranslationsPanel type="project" groupId={p.translationGroupId} currentId={p.id} currentLang={p.language} />
      <a href={`/api/preview?path=${encodeURIComponent(localizedHref(p.language, ["projects", p.slug]))}`} target="_blank" rel="noopener" className="inline-block mb-5 text-sm text-[#1B4B43] hover:underline">Preview draft ↗</a>

      <ProjectEditForm
        project={{
          id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, status: p.status,
          scheduledAtInput: utcToZonedInput(p.scheduledAt), city: p.city, propertyType: p.propertyType,
          price: p.price, listingPriority: p.listingPriority, isFeatured: p.isFeatured, isNew: p.isNew, isSold: p.isSold,
          previewImage: p.previewImage, images: p.images, latitude: p.latitude, longitude: p.longitude,
          seoTitle: seo.metaTitle ?? "", seoDescription: seo.metaDescription ?? "",
          description: p.description, fullDescription: p.fullDescription,
        }}
      />
    </div>
  );
}
