// Owner design page: the server-action logic with the store injected (controller ruling R8).
// actions.ts ("use server") wires in getCrmUser, the Prisma store and revalidatePath.
// No Prisma / Next imports here, so the guard and the validation order are unit-tested.
import { DEFAULT_GLOBAL, emailTheme, normalizeGlobal, normalizeSetValues, validateGlobal, type ContrastWarning, type GlobalSettings, type RoleKey, type SetValues } from "@/lib/design/theme";
import { buildApprovedEmail, partnerBaseUrl } from "@/lib/partner/mail";
import type { ThemeRow } from "@/lib/design/store";
import { copyName, isIdArg, needsContrastConfirm, parseThemeInput } from "./designForm";

export const OWNER_ONLY = "Owner only";
const GENERIC = "Could not save — try again or reload.";

type Actor = { id: string; name: string; email: string };
type Viewer = Actor & { isOwner: boolean };

export type DesignStore = {
  listThemes: () => Promise<ThemeRow[]>;
  saveTheme: (actor: Actor, input: { id?: string; name: string; values: SetValues; offeredToStaff: boolean; offeredToPartners: boolean }) => Promise<string>;
  deleteTheme: (actor: Actor, id: string) => Promise<void>;
  makeDefaultTheme: (actor: Actor, id: string) => Promise<void>;
  restoreThemeVersion: (actor: Actor, versionId: string) => Promise<void>;
  restoreBuiltIn: (actor: Actor, id: string) => Promise<void>;
  saveGlobal: (actor: Actor, value: GlobalSettings, note: string | null) => Promise<void>;
};

export type SaveThemeInput = {
  id?: string; name: string; values: Record<string, string>;
  offeredToStaff: boolean; offeredToPartners: boolean; confirmLowContrast: boolean;
};
export type Fail = { ok: false; error: string };
export type SaveThemeResult =
  | { ok: true; id: string }
  | { ok: false; error: string; warnings?: ContrastWarning[]; fieldErrors?: Partial<Record<RoleKey, string>> };
export type SimpleResult = { ok: true } | Fail;
export type IdResult = { ok: true; id: string } | Fail;
export type GlobalResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };
export type HtmlResult = { ok: true; html: string } | Fail;

// baseUrl: the partner host for the sample login link (defaults to partnerBaseUrl()).
type Deps = { getUser: () => Promise<Viewer | null>; store: DesignStore; revalidate: () => void; baseUrl?: () => string };

// The store throws Error(<refusal text>) when a rule is broken; that text goes to the owner.
// Database errors carry internals, so they get a generic message (and the log).
function refusal(e: unknown): Fail {
  if (e instanceof Error && !e.name.startsWith("PrismaClient")) return { ok: false, error: e.message };
  console.error("[design settings]", e);
  return { ok: false, error: GENERIC };
}

export function makeDesignActions({ getUser, store, revalidate, baseUrl = () => partnerBaseUrl() }: Deps) {
  async function owner(): Promise<Actor | null> {
    const u = await getUser();
    return u && u.isOwner ? { id: u.id, name: u.name, email: u.email } : null;
  }

  async function write(fn: (actor: Actor) => Promise<void>, idArg?: unknown): Promise<SimpleResult> {
    const actor = await owner();
    if (!actor) return { ok: false, error: OWNER_ONLY };
    if (idArg !== undefined && !isIdArg(idArg)) return { ok: false, error: "Not recognised — reload." };
    try {
      await fn(actor);
    } catch (e) {
      return refusal(e);
    }
    revalidate();
    return { ok: true };
  }

  return {
    async saveTheme(input: SaveThemeInput): Promise<SaveThemeResult> {
      const actor = await owner();
      if (!actor) return { ok: false, error: OWNER_ONLY };
      let id: string;
      try {
        const parsed = parseThemeInput(input, await store.listThemes());
        if (!parsed.ok) return parsed;
        const warnings = needsContrastConfirm(parsed.value.values, parsed.value.confirmLowContrast);
        if (warnings) return { ok: false, error: "Some text is hard to read in this set. Check the warnings, then use Save anyway.", warnings };
        const { confirmLowContrast: _c, ...value } = parsed.value;
        id = await store.saveTheme(actor, value);
      } catch (e) {
        return refusal(e);
      }
      revalidate();
      return { ok: true, id };
    },

    deleteTheme: (id: string) => write((a) => store.deleteTheme(a, id), id),
    makeDefaultTheme: (id: string) => write((a) => store.makeDefaultTheme(a, id), id),
    restoreThemeVersion: (versionId: string) => write((a) => store.restoreThemeVersion(a, versionId), versionId),
    restoreBuiltIn: (id: string) => write((a) => store.restoreBuiltIn(a, id), id),

    // A copy is never offered until the owner says so; the values are copied as stored
    // (a low-contrast source was already confirmed when it was saved).
    async duplicateTheme(id: string): Promise<IdResult> {
      const actor = await owner();
      if (!actor) return { ok: false, error: OWNER_ONLY };
      if (!isIdArg(id)) return { ok: false, error: "Unknown set" };
      let newId: string;
      try {
        const rows = await store.listThemes();
        const src = rows.find((r) => r.id === id);
        if (!src) return { ok: false, error: "Unknown set" };
        newId = await store.saveTheme(actor, { name: copyName(src.name, rows), values: { ...src.values }, offeredToStaff: false, offeredToPartners: false });
      } catch (e) {
        return refusal(e);
      }
      revalidate();
      return { ok: true, id: newId };
    },

    async saveGlobal(input: Record<string, unknown>): Promise<GlobalResult> {
      const actor = await owner();
      if (!actor) return { ok: false, error: OWNER_ONLY };
      const v = validateGlobal(input);
      if (!v.ok) return { ok: false, error: "Some settings are out of range", fieldErrors: v.errors };
      try {
        await store.saveGlobal(actor, v.value, null);
      } catch (e) {
        return refusal(e);
      }
      revalidate();
      return { ok: true };
    },

    resetGlobal: () => write((a) => store.saveGlobal(a, { ...DEFAULT_GLOBAL }, "reset")),

    // Live preview of a partner email in the unsaved draft: the "account approved" mail to a
    // sample partner. Read-only (no store, no revalidate); junk input falls back to Classic and
    // the default settings, so only validated colours and numbers reach the HTML.
    async previewEmail(values: unknown, global: unknown): Promise<HtmlResult> {
      if (!(await owner())) return { ok: false, error: OWNER_ONLY };
      try {
        const theme = emailTheme(normalizeSetValues(values), normalizeGlobal(global));
        return { ok: true, html: buildApprovedEmail("en", "Anna", `${baseUrl()}/login`, theme).html };
      } catch (e) {
        console.error("[design preview]", e);
        return { ok: false, error: "Could not render the email preview." };
      }
    },
  };
}
