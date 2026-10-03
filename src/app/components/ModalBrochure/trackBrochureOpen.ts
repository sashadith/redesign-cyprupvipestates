/* One place that reports an opening of the brochure/consultation modal.
 *
 * It existed twice before, copied between ConsultButton and the header's own
 * button, and both copies sent the identical payload — which meant the three
 * entry points were not merely comparable in Events Manager, they were
 * indistinguishable. There was no way to ask whether the header button earned
 * its place, or whether the brochure block outperforms the hero.
 *
 * `source` fixes that, and the union type is what keeps it honest: a new entry
 * point cannot be added without naming itself, and a typo fails the build rather
 * than quietly landing in a bucket nobody notices.
 *
 * `form_name` deliberately keeps its old value. It is what the existing
 * reporting groups on, so anything built before today keeps working and the new
 * dimension is additive.
 */
export type BrochureSource = "header" | "hero" | "brochure_block";

export function trackBrochureOpen(source: BrochureSource): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;
  fbq("track", "InitiateCheckout", {
    form_name: "brochure_modal",
    source,
    page_location: window.location.href,
  });
}
