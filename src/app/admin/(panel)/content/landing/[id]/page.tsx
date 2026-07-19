import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LandingPageEditForm from "./LandingPageEditForm";

export const dynamic = "force-dynamic";
const TYPES = ["blogPage", "caseStudiesPage", "projectsPage", "notFoundPage"];
const EXCLUDE = new Set(["title", "metaTitle", "metaDescription", "slug", "_type", "content", "seo"]);

export default async function EditLandingPage({ params }: { params: { id: string } }) {
  const doc = await prisma.siteDocument.findUnique({ where: { id: params.id } });
  if (!doc || !TYPES.includes(doc.type)) notFound();
  const d = (doc.data as any) ?? {};
  const seo = d.seo && typeof d.seo === "object" ? d.seo : { metaTitle: d.metaTitle, metaDescription: d.metaDescription };
  const extras = Object.entries(d).filter(([k, v]) => typeof v === "string" && !EXCLUDE.has(k)) as [string, string][];

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/landing" className="text-sm text-[#1B4B43] hover:underline">← Back to landing pages</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">{doc.type} · {doc.language.toUpperCase()}</h1>

      <LandingPageEditForm
        docId={doc.id}
        title={d.title ?? ""}
        extras={extras}
        seoTitle={seo.metaTitle ?? ""}
        seoDescription={seo.metaDescription ?? ""}
        content={d.content}
      />
    </div>
  );
}
