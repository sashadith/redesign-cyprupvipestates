// Onboarding checklist (partner portal phase 3d). Pure: the page computes the booleans server-side.
// Step keys are dictionary keys under onboarding.steps.
export type OnboardingFacts = { agreementAccepted: boolean; bankComplete: boolean; hasClient: boolean; emailVerified: boolean };

export type OnboardingKey = "emailVerified" | "agreementAccepted" | "bankComplete" | "hasClient";

export function onboardingSteps(f: OnboardingFacts): {
  steps: { key: OnboardingKey; done: boolean }[];
  done: number;
  total: number;
  complete: boolean;
} {
  const steps: { key: OnboardingKey; done: boolean }[] = [
    { key: "emailVerified", done: f.emailVerified },
    { key: "agreementAccepted", done: f.agreementAccepted },
    { key: "bankComplete", done: f.bankComplete },
    { key: "hasClient", done: f.hasClient },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
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
}): OnboardingFacts {
  return {
    // Only verified accounts can log in, and ACTIVE requires approval after verification.
    emailVerified: input.status === "ACTIVE",
    agreementAccepted: input.hasAcceptance,
    bankComplete: input.bankComplete,
    hasClient: input.hasClaim,
  };
}
