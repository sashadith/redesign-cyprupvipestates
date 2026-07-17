import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { saveFaqPage } from "../../../../actions";
import FaqPageEditor from "../FaqPageEditor";

export const dynamic = "force-dynamic";
const LANGS = ["en", "de", "pl", "ru"];

export default async function EditFaqPage({ params }: { params: { lang: string } }) {
  if (!LANGS.includes(params.lang)) notFound();
  const doc = await prisma.siteDocument.findUnique({ where: { type_language: { type: "faqPage", language: params.lang as any } } });
  const categories = Array.isArray((doc?.data as any)?.categories) ? (doc!.data as any).categories : [];

  return (
    <div className="max-w-3xl">
      <Link href="/admin/content/faq" className="text-sm text-[#1B4B43] hover:underline">← Back to FAQ</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">FAQ · {params.lang.toUpperCase()}</h1>
      <FaqPageEditor lang={params.lang} initial={categories} save={saveFaqPage.bind(null, params.lang)} />
    </div>
  );
}
