import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTranslation } from "./actions";

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
  currentLang,
}: {
  type: keyof typeof PATHS;
  groupId: string | null | undefined;
  currentId: string;
  currentLang: string;
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
      <div className="flex flex-wrap gap-2">
        {LOCALES.map((l) => {
          if (l === currentLang) {
            return <span key={l} className="rounded-md bg-[#1B4B43] text-white text-sm px-3 py-1.5">{l.toUpperCase()} · editing</span>;
          }
          const id = byLang.get(l);
          if (id) {
            return <Link key={l} href={`/admin/content/${path}/${id}`} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 text-[#1B4B43] hover:bg-[#1B4B43]/5">{l.toUpperCase()}</Link>;
          }
          // Missing → create a linked translation from this document.
          return (
            <form key={l} action={createTranslation.bind(null, type, currentId, l)}>
              <button type="submit" className="rounded-md border border-dashed border-[#C29A5E] text-sm px-3 py-1.5 text-[#C29A5E] hover:bg-[#C29A5E]/10">
                + {l.toUpperCase()} translation
              </button>
            </form>
          );
        })}
      </div>
      <p className="text-[11px] text-[#9CA3AF] mt-2">Creating a translation copies this document’s content as a starting point, linked to the same group. The new version opens as a draft you can edit and translate.</p>
    </div>
  );
}
