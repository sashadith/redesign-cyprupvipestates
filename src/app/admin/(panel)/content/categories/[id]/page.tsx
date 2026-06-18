import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCategory } from "../../../../actions";

export const dynamic = "force-dynamic";
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditCategory({ params }: { params: { id: string } }) {
  const c = await prisma.category.findUnique({ where: { id: params.id } });
  if (!c) notFound();
  const save = updateCategory.bind(null, c.id);

  return (
    <div className="max-w-xl">
      <Link href="/admin/content/categories" className="text-sm text-[#1B4B43] hover:underline">← Back to categories</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{c.title}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{c.language.toUpperCase()} · /{c.slug} <span className="text-[#C29A5E]">(slug locked)</span></p>
      <form action={save} className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" defaultValue={c.title} className={input} />
        </div>
        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save category</button>
      </form>
    </div>
  );
}
