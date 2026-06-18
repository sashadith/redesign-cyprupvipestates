import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateFooterSettings } from "../../actions";

export const dynamic = "force-dynamic";
const LOCALES = ["en", "de", "pl", "ru"];
const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default async function SettingsPage({ searchParams }: { searchParams: { lang?: string } }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") redirect("/admin");
  const lang = LOCALES.includes(searchParams.lang ?? "") ? searchParams.lang! : "en";
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "footer", language: lang as any } } });
  const d = (row?.data as any) ?? {};
  const contacts: any[] = Array.isArray(d.contacts) ? d.contacts : [];
  const socialLinks: any[] = Array.isArray(d.socialLinks) ? d.socialLinks : [];
  const CONTACT_TYPES = ["Email", "Phone", "Link"];
  const save = updateFooterSettings.bind(null, lang);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Site settings</h1>
      <p className="text-sm text-[#6B7280] mb-4">Footer legal text, contact details and social links per language. Icons and logos are managed separately.</p>
      <div className="flex gap-1 mb-4">
        {LOCALES.map((l) => (
          <Link key={l} href={`/admin/settings?lang=${l}`}
            className={`rounded-md px-3 py-1.5 text-sm ${l === lang ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB]"}`}>
            {l.toUpperCase()}
          </Link>
        ))}
      </div>

      <form action={save} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">Copyright</label>
          <input name="copyright" defaultValue={d.copyright ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">VAT number</label>
          <input name="vatNumber" defaultValue={d.vatNumber ?? ""} className={input} />
        </div>
        <div>
          <label className="block text-sm mb-1">Disclaimer</label>
          <textarea name="disclaimer" rows={5} defaultValue={d.discklaimer ?? ""} className={input} />
        </div>

        {contacts.length > 0 && (
          <div className="pt-2 border-t border-[#E5E7EB]">
            <h2 className="text-sm font-semibold mb-2">Contact details</h2>
            <div className="space-y-3">
              {contacts.map((c, i) => (
                <div key={c._key ?? i} className="flex gap-2">
                  <select name={`contact_${i}_type`} defaultValue={c.type ?? "Email"}
                    className={`${input} w-28 shrink-0`}>
                    {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input name={`contact_${i}_label`} defaultValue={c.label ?? ""}
                    className={input} placeholder="e.g. office@cyprusvipestates.com" />
                </div>
              ))}
            </div>
          </div>
        )}

        {socialLinks.length > 0 && (
          <div className="pt-2 border-t border-[#E5E7EB]">
            <h2 className="text-sm font-semibold mb-2">Social links</h2>
            <div className="space-y-3">
              {socialLinks.map((s, i) => (
                <div key={s._key ?? i} className="flex gap-2 items-center">
                  <span className="w-24 shrink-0 text-sm text-[#6B7280]">{s.label ?? `Link ${i + 1}`}</span>
                  <input name={`social_${i}_link`} defaultValue={s.link ?? ""}
                    className={input} placeholder="https://…" />
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">Save settings</button>
      </form>
    </div>
  );
}
