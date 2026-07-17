import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createFaqTranslation } from "../../../actions";

export const dynamic = "force-dynamic";

const LANGS = ["en", "de", "pl", "ru"] as const;
const LANG_NAMES: Record<string, string> = { en: "English", de: "Deutsch", pl: "Polski", ru: "Русский" };

export default async function FaqList() {
  const docs = await prisma.siteDocument.findMany({ where: { type: "faqPage" } });
  const byLang = new Map(docs.map((d) => [d.language, d]));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">FAQ page</h1>
      <p className="text-sm text-[#6B7280] mb-5">
        Categories and Q&amp;A content for the redesigned FAQ page (/faq). One set of content per language —
        categories are in-page sections, not separate URLs, so there&apos;s no per-question translation link like Blog
        or Case Studies.
      </p>
      <div className="bg-white rounded-lg border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
        {LANGS.map((lang) => {
          const doc = byLang.get(lang);
          const categories = Array.isArray((doc?.data as any)?.categories) ? (doc!.data as any).categories : [];
          const questionCount = categories.reduce((n: number, c: any) => n + (c.items?.length ?? 0), 0);
          return (
            <div key={lang} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{LANG_NAMES[lang]} ({lang.toUpperCase()})</div>
                <div className="text-xs text-[#9CA3AF]">
                  {doc ? `${categories.length} categories · ${questionCount} questions` : "not created yet"}
                </div>
              </div>
              {doc ? (
                <Link href={`/admin/content/faq/${lang}`} className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#1B4B43] hover:bg-[#1B4B43]/5">
                  Edit
                </Link>
              ) : (
                <form action={createFaqTranslation.bind(null, lang, "en")}>
                  <button type="submit" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#1B4B43] hover:bg-[#1B4B43]/5">
                    Create from English
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
