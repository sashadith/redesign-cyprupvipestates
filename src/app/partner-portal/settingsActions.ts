"use server";
/**
 * Phase 3d: profile email settings and hiding the onboarding card. Both are scoped to the session's own
 * partner (requirePartner({ active: true })) — never an id from the form.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { partnerLimits as L } from "@/lib/partner/limits";
import { ONBOARDING_DISMISS_COOKIE, ONBOARDING_DISMISS_MAX_AGE } from "@/lib/partner/onboarding";
import { requirePartner } from "@/lib/partner/session";
import type { SettingsState } from "./formState";

const checked = (fd: FormData, k: string) => fd.get(k) === "on";

export async function savePartnerSettingsAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const me = await requirePartner({ active: true });
  if (!L.profile.hit(me.partner.id)) return { error: "err.rateLimited" };
  const saved = await prisma.partner.update({
    where: { id: me.partner.id },
    data: { emailNotifications: checked(fd, "emailNotifications"), digestOptIn: checked(fd, "digestOptIn") },
    select: { emailNotifications: true, digestOptIn: true },
  });
  return { ok: true, ...saved };
}

export async function dismissOnboardingAction(): Promise<void> {
  await requirePartner({ active: true });
  cookies().set(ONBOARDING_DISMISS_COOKIE, "1", {
    maxAge: ONBOARDING_DISMISS_MAX_AGE, sameSite: "lax", path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/partner-portal/home");
}
