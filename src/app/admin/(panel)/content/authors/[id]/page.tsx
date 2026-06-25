import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateAuthorMeta } from "../../../../actions";
import ImagePicker from "@/app/admin/ImagePicker";
import TranslationsPanel from "@/app/admin/TranslationsPanel";

export const dynamic = "force-dynamic";
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditAuthor({ params }: { params: { id: string } }) {
  const a = await prisma.author.findUnique({ where: { id: params.id } });
  if (!a) notFound();
  const save = updateAuthorMeta.bind(null, a.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/authors" className="text-sm text-[#1B4B43] hover:underline">← Back to authors</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{a.name}</h1>
      <p className="text-sm text-[#6B7280] mb-6">{a.language.toUpperCase()}</p>
      <TranslationsPanel type="author" groupId={a.translationGroupId} currentId={a.id} currentLang={a.language} />

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input name="name" defaultValue={a.name} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Position</label>
            <input name="position" defaultValue={a.position ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Bio</label>
            <textarea name="bio" rows={4} defaultValue={a.bio ?? ""} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">Specialization <span className="text-[#9CA3AF]">(one per line)</span></label>
            <textarea name="specialization" rows={4} defaultValue={(a.specialization ?? []).join("\n")} className={input} />
          </div>
          <div>
            <label className="block text-sm mb-1">LinkedIn URL</label>
            <input name="linkedin" defaultValue={a.linkedin ?? ""} className={input} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Photo</h2>
          <ImagePicker name="image" initial={a.image} label="Author photo" />
        </div>

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save author</button>
      </form>
    </div>
  );
}
