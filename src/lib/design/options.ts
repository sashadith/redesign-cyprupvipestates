// Client-safe shape of an offered colour set for the personal pickers (no Prisma, no secrets).
import type { ThemeRow } from "./store";

export type ThemeOption = { id: string; name: string; isDefault: boolean; swatch: { page: string; card: string; accent: string; text: string } };

export function toOptions(rows: ThemeRow[]): ThemeOption[] {
  return [...rows].sort((a, b) => a.sort - b.sort).map((r) => ({
    id: r.id, name: r.name, isDefault: r.isDefault,
    swatch: { page: r.values.page, card: r.values.card, accent: r.values.accent, text: r.values.text },
  }));
}

/** The stored choice counts only while that set is still offered; otherwise the viewer is on the default. */
export function effectiveChoice(choiceId: string | null, options: ThemeOption[]): string | null {
  return choiceId && options.some((o) => o.id === choiceId) ? choiceId : null;
}
