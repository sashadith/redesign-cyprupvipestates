import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateFormDoc } from "../../../../actions";

export const dynamic = "force-dynamic";
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

function label(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export default async function EditForm({ params }: { params: { id: string } }) {
  const doc = await prisma.siteDocument.findUnique({ where: { id: params.id } });
  if (!doc || doc.type !== "formStandardDocument") notFound();
  const form = ((doc.data as any)?.form ?? {}) as Record<string, any>;
  const fields = Object.entries(form).filter(([k, v]) => !k.startsWith("_") && typeof v === "string");
  const save = updateFormDoc.bind(null, doc.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/forms" className="text-sm text-[#1B4B43] hover:underline">← Back to forms</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Standard form · {doc.language.toUpperCase()}</h1>
      <form action={save} className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        {fields.map(([k, v]) => (
          <div key={k}>
            <label className="block text-sm mb-1">{label(k)}</label>
            {String(v).length > 60
              ? <textarea name={`f_${k}`} rows={3} defaultValue={String(v)} className={input} />
              : <input name={`f_${k}`} defaultValue={String(v)} className={input} />}
          </div>
        ))}
        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save form</button>
      </form>
    </div>
  );
}
