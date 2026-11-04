import { notFound } from "next/navigation";
import { getCrmUser } from "@/lib/crm/session";
import { globalHistory, listThemes, loadGlobal, themeHistory } from "@/lib/design/store";
import { DesignEditor, type GlobalVersion, type ThemeVersion } from "./DesignEditor";

export const dynamic = "force-dynamic";

// Owner only (isOwner from the DB on every request); everyone else gets a 404, as if the page didn't exist.
export default async function DesignSettingsPage() {
  const user = await getCrmUser();
  if (!user?.isOwner) notFound();

  const [themes, global, gHist] = await Promise.all([listThemes(), loadGlobal(), globalHistory()]);
  const histories: Record<string, ThemeVersion[]> = Object.fromEntries(
    await Promise.all(
      themes.map(async (t) => [t.id, (await themeHistory(t.id)).map((v) => ({ id: v.id, name: v.name, values: v.values, createdAt: v.createdAt.toISOString() }))] as const),
    ),
  );
  const globalVersions: GlobalVersion[] = gHist.map((v) => ({ id: v.id, values: v.values, note: v.note, createdAt: v.createdAt.toISOString() }));

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Design</h1>
          <p>Colour sets for the CRM, the partner portal and partner emails, plus the fonts, sizes and corner rounding everyone shares.</p>
        </div>
      </div>
      <DesignEditor themes={themes} global={global} histories={histories} globalHistory={globalVersions} />
    </>
  );
}
