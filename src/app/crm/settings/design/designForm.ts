// Owner design page: pure parsing of a colour-set save (no Prisma / Next imports).
import { contrastWarnings, validateSetValues, type ContrastWarning, type RoleKey, type SetValues } from "@/lib/design/theme";

export const NAME_MAX = 40;
export const DUPLICATE_NAME = "A set with this name already exists";

export type ThemeInput = {
  id?: string; name: string; values: SetValues;
  offeredToStaff: boolean; offeredToPartners: boolean; confirmLowContrast: boolean;
};
export type ParseResult =
  | { ok: true; value: ThemeInput }
  | { ok: false; error: string; fieldErrors?: Partial<Record<RoleKey, string>> };

type Named = { id: string; name: string };

export function isIdArg(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// `sets` are the existing sets; the name must be unique among them (case-insensitive),
// ignoring the set being saved itself.
export function parseThemeInput(raw: unknown, sets: Named[] = []): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Nothing to save" };
  const r = raw as Record<string, unknown>;
  if (r.id !== undefined && !isIdArg(r.id)) return { ok: false, error: "Set not recognised — reload." };
  const id = r.id as string | undefined;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return { ok: false, error: "The set needs a name" };
  if (name.length > NAME_MAX) return { ok: false, error: `The name can have at most ${NAME_MAX} characters` };
  if (sets.some((s) => s.id !== id && sameName(s.name, name))) return { ok: false, error: DUPLICATE_NAME };
  for (const k of ["offeredToStaff", "offeredToPartners", "confirmLowContrast"] as const) {
    if (typeof r[k] !== "boolean") return { ok: false, error: `${k} must be true or false` };
  }
  const v = validateSetValues(r.values);
  if (!v.ok) return { ok: false, error: "Some colours are not valid #RRGGBB values", fieldErrors: v.errors };
  return {
    ok: true,
    value: {
      ...(id !== undefined ? { id } : {}), name, values: v.values,
      offeredToStaff: r.offeredToStaff as boolean, offeredToPartners: r.offeredToPartners as boolean,
      confirmLowContrast: r.confirmLowContrast as boolean,
    },
  };
}

// The contrast warnings that still need an explicit "Save anyway", or null when saving may go ahead.
export function needsContrastConfirm(values: SetValues, confirm: boolean): ContrastWarning[] | null {
  if (confirm) return null;
  const w = contrastWarnings(values);
  return w.length ? w : null;
}

// "<name> copy", then "<name> copy 2", 3, … — unique among `sets` and at most NAME_MAX characters.
export function copyName(name: string, sets: Named[]): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? " copy" : ` copy ${n}`;
    const candidate = name.trim().slice(0, NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!sets.some((s) => sameName(s.name, candidate))) return candidate;
  }
}
