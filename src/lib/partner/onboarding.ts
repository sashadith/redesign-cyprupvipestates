// Onboarding checklist (partner portal phase 3d). Pure: the page computes the booleans server-side.
// Step keys are dictionary keys under onboarding.steps.
export type OnboardingFacts = {
  agreementAccepted: boolean; bankComplete: boolean; hasClient: boolean; emailVerified: boolean;
  /** Present only for an EU company (VAT number required); `done` once it is stored. */
  vatId?: { done: boolean };
  /** Present only while the partner bot is configured (phase 3e); optional — `done` once a chat is linked. */
  telegram?: { done: boolean };
  /** "First presentation sent" (phase 3e): present for ACTIVE partners; `done` once they created one. */
  presentation?: { done: boolean };
};

export type OnboardingKey = "emailVerified" | "agreementAccepted" | "bankComplete" | "hasClient" | "vatId" | "presentation" | "telegram";
export type OnboardingStep = { key: OnboardingKey; done: boolean; optional?: true };

/**
 * Optional steps (Telegram) are listed but never block completion: they count toward done/total only once
 * done, so "3 of 4" never turns into "3 of 5" because of an optional item, and linking adds one to both.
 */
export function onboardingSteps(f: OnboardingFacts): {
  steps: OnboardingStep[];
  done: number;
  total: number;
  complete: boolean;
} {
  const steps: OnboardingStep[] = [
    { key: "emailVerified", done: f.emailVerified },
    { key: "agreementAccepted", done: f.agreementAccepted },
    { key: "bankComplete", done: f.bankComplete },
    { key: "hasClient", done: f.hasClient },
  ];
  if (f.vatId) steps.push({ key: "vatId", done: f.vatId.done });
  if (f.presentation) steps.push({ key: "presentation", done: f.presentation.done });
  if (f.telegram) steps.push({ key: "telegram", done: f.telegram.done, optional: true });
  const counted = steps.filter((s) => !s.optional || s.done);
  const done = counted.filter((s) => s.done).length;
  return { steps, done, total: counted.length, complete: done === counted.length };
}

/** Cookie set by the "Hide" action on /home (1 year); read in render only. */
export const ONBOARDING_DISMISS_COOKIE = "cve_partner_onboarding_dismissed";
export const ONBOARDING_DISMISS_MAX_AGE = 60 * 60 * 24 * 365;

/** Where each open step is done (partner-host paths); null = nothing to do in the portal. */
export function onboardingHref(key: OnboardingKey): string | null {
  switch (key) {
    case "agreementAccepted":
      return "/agreement";
    case "bankComplete":
      return "/profile#bank";
    case "hasClient":
      return "/submit";
    case "vatId":
      return "/profile";
    case "telegram":
      return "/profile#telegram";
    case "presentation":
      return "/presentations";
    default:
      return null;
  }
}

/**
 * Raw per-partner rows → facts. `bankComplete` is computed by the caller with bankDetailsComplete on the
 * decrypted details (plus a stored IBAN last 4, like the payout check); an unreadable blob counts as not done.
 */
export function onboardingFactsFrom(input: {
  status: string;
  hasAcceptance: boolean;
  bankComplete: boolean;
  hasClaim: boolean;
  /** Stored country/company/VAT number; adds the VAT step for an EU company (see vatIdRequired). */
  vat?: { required: boolean; set: boolean };
  /** Partner bot configured (partnerBotConfigured) and whether this partner has a linked chat. */
  telegram?: { available: boolean; linked: boolean };
  /** Whether any presentation with partnerId = this partner exists; omitted → no presentation step. */
  hasPresentation?: boolean;
}): OnboardingFacts {
  return {
    // Only verified accounts can log in, and ACTIVE requires approval after verification.
    emailVerified: input.status === "ACTIVE",
    agreementAccepted: input.hasAcceptance,
    bankComplete: input.bankComplete,
    hasClient: input.hasClaim,
    ...(input.vat?.required ? { vatId: { done: input.vat.set } } : {}),
    ...(input.hasPresentation !== undefined ? { presentation: { done: input.hasPresentation } } : {}),
    // A linked chat counts even if the bot env was removed later; an unlinked one is offered only while available.
    ...(input.telegram && (input.telegram.available || input.telegram.linked) ? { telegram: { done: input.telegram.linked } } : {}),
  };
}

/** The "Hide" cookie hides the card, except while the VAT number is missing (that item stays until it is set). */
export function onboardingVisible(o: { complete: boolean; steps: OnboardingStep[] }, dismissed: boolean): boolean {
  if (o.complete) return false;
  return !dismissed || o.steps.some((s) => s.key === "vatId" && !s.done);
}
