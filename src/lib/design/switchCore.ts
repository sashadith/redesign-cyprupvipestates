// Pure, dependency-injected cores of the personal colour-set actions (unit-tested; no next/* or Prisma here).
// The "use server" wrappers (crm/themeActions.ts, partner-portal/themeAction.ts) inject the real store.
export type SwitchResult = { ok: boolean };

const validChoice = (v: unknown): v is string | null => v === null || (typeof v === "string" && v.length > 0 && v.length <= 64);

export async function staffThemeCore(
  user: { id: string } | null,
  themeId: string | null,
  deps: { setChoice: (userId: string, themeId: string | null) => Promise<boolean>; revalidate: () => void },
): Promise<SwitchResult> {
  if (!user || !validChoice(themeId)) return { ok: false };
  const ok = await deps.setChoice(user.id, themeId);
  if (ok) deps.revalidate();
  return { ok };
}

export async function partnerThemeCore(
  me: { partner: { id: string; status: string } } | null,
  themeId: string | null,
  deps: { setChoice: (partnerId: string, themeId: string | null) => Promise<boolean> },
): Promise<SwitchResult> {
  if (!me || me.partner.status !== "ACTIVE" || !validChoice(themeId)) return { ok: false };
  return { ok: await deps.setChoice(me.partner.id, themeId) };
}
