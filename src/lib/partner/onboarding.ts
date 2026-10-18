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
