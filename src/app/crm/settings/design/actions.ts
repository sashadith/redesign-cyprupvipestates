"use server";
import { revalidatePath } from "next/cache";
import { getCrmUser } from "@/lib/crm/session";
import { deleteTheme, listThemes, makeDefaultTheme, restoreBuiltIn, restoreThemeVersion, saveGlobal, saveTheme } from "@/lib/design/store";
import { makeDesignActions, type GlobalResult, type IdResult, type SaveThemeInput, type SaveThemeResult, type SimpleResult } from "./actionsCore";

// Owner design page writes (/crm/settings/design). Thin wrapper: the owner guard, validation
// and refusal handling live in actionsCore.ts (unit-tested); the store audits every write.
function core() {
  return makeDesignActions({
    getUser: getCrmUser,
    store: {
      listThemes: () => listThemes(),
      saveTheme: (a, input) => saveTheme(a, input),
      deleteTheme: (a, id) => deleteTheme(a, id),
      makeDefaultTheme: (a, id) => makeDefaultTheme(a, id),
      restoreThemeVersion: (a, id) => restoreThemeVersion(a, id),
      restoreBuiltIn: (a, id) => restoreBuiltIn(a, id),
      saveGlobal: (a, v, note) => saveGlobal(a, v, note),
    },
    revalidate: () => revalidatePath("/crm", "layout"),
  });
}

export async function saveThemeAction(input: SaveThemeInput): Promise<SaveThemeResult> { return core().saveTheme(input); }
export async function deleteThemeAction(id: string): Promise<SimpleResult> { return core().deleteTheme(id); }
export async function makeDefaultThemeAction(id: string): Promise<SimpleResult> { return core().makeDefaultTheme(id); }
export async function restoreThemeVersionAction(versionId: string): Promise<SimpleResult> { return core().restoreThemeVersion(versionId); }
export async function restoreBuiltInAction(id: string): Promise<SimpleResult> { return core().restoreBuiltIn(id); }
export async function duplicateThemeAction(id: string): Promise<IdResult> { return core().duplicateTheme(id); }
export async function saveGlobalAction(input: Record<string, unknown>): Promise<GlobalResult> { return core().saveGlobal(input); }
export async function resetGlobalAction(): Promise<SimpleResult> { return core().resetGlobal(); }
