import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Shows the language versions linked to the current document (via
// translationGroupId) so editors can jump between them and see which languages
// exist or are still missing — without restructuring the data model.

const LOCALES = ["en", "de", "pl", "ru"];
const PATHS: Record<string, string> = {
  project: "projects",
  blog: "blog",
  singlepage: "pages",
  caseStudy: "case-studies",
  developer: "developers",
  author: "authors",
  category: "categories",
};

export default async function TranslationsPanel({
  type,
  groupId,
  currentId,
}: {
  type: keyof typeof PATHS;
  groupId: string | null | undefined;
  currentId: string;
}) {
  const path = PATHS[type];
  const model = (prisma as any)[type];
  const siblings: { id: string; language: string }[] = groupId
    ? await model.findMany({ where: { translationGroupId: groupId }, select: { id: true, language: true } })
    : [];
  const byLang = new Map(siblings.map((s) => [s.language, s.id]));

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 mb-5">
      <h2 className="text-sm font-semibold mb-2">Translations</h2>
      {!groupId ? (
        <p className="text-xs text-[#9CA3AF]">This document isn’t linked to other languages.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((l) => {
            const id = byLang.get(l);
            if (id === currentId) {
              return <span key={l} className="rounded-md bg-[#1B4B43] text-white text-sm px-3 py-1.5">{l.toUpperCase()} · editing</span>;
            }
            if (id) {
              return <Link key={l} href={`/admin/content/${path}/${id}`} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 text-[#1B4B43] hover:bg-[#1B4B43]/5">{l.toUpperCase()}</Link>;
            }
            return <span key={l} className="rounded-md border border-dashed border-[#E5E7EB] text-sm px-3 py-1.5 text-[#9CA3AF]" title="Not translated yet">{l.toUpperCase()} — missing</span>;
          })}
        </div>
      )}
    </div>
  );
}
