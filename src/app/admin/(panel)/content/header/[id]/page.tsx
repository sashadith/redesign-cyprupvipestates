import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateHeaderDoc } from "../../../../actions";
import ImagePicker from "@/app/admin/ImagePicker";

export const dynamic = "force-dynamic";
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function EditHeader({ params }: { params: { id: string } }) {
  const doc = await prisma.siteDocument.findUnique({ where: { id: params.id } });
  if (!doc || doc.type !== "header") notFound();
  const d = (doc.data as any) ?? {};
  const navLinks: any[] = Array.isArray(d.navLinks) ? d.navLinks : [];
  const save = updateHeaderDoc.bind(null, doc.id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/content/header" className="text-sm text-[#1B4B43] hover:underline">← Back to header</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Header · {doc.language.toUpperCase()}</h1>

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Logos</h2>
          <ImagePicker name="logo" initial={d.logo} label="Logo" />
          <ImagePicker name="logoMobile" initial={d.logoMobile} label="Logo (mobile)" />
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-3">
          <h2 className="text-sm font-semibold">Navigation links</h2>
          <p className="text-xs text-[#9CA3AF]">Sub-menus are preserved; edit the top-level label and link here.</p>
          {navLinks.map((n, i) => (
            <div key={n._key ?? i} className="flex gap-2">
              <input name={`nav_${i}_label`} defaultValue={n.label ?? ""} className={`${input} w-44 shrink-0`} placeholder="Label" />
              <input name={`nav_${i}_link`} defaultValue={n.link ?? ""} className={input} placeholder="/path" />
            </div>
          ))}
        </div>

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save header</button>
      </form>
    </div>
  );
}
