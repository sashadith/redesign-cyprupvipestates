"use client";

import { useEffect } from "react";

/**
 * Meta pixel ViewContent for one property page.
 *
 * Until 2026-10-17 this component existed but never fired on the pages that
 * matter. It sat in src/app/[lang]/projects/[slug]/page.tsx AFTER the branch
 * that renders a Development and returns — so all 370 published developments
 * rendered without it, and only the legacy Project branch behind it could
 * reach it. Meta's own numbers confirmed it before this was changed: over
 * seven days the dataset recorded ~900 PageView, 5 InitiateCheckout, 2 Lead,
 * 1 Contact and ZERO ViewContent. It now renders from ProjectPageBody, which
 * is the component the development branch actually returns.
 *
 * Three things here are load-bearing and easy to get subtly wrong:
 *
 * 1. `contentId` must be the Development row's UUID — the same key the Xellex
 *    bridge uses and the same one a Meta catalog would carry. The page's view
 *    model exposes `id` as the VENDOR's feedProjectId, which is a different
 *    string and changes when a project moves source. Pixel ids that disagree
 *    with catalog ids match nothing while both sides look healthy.
 * 2. `content_type` is "home_listing", Meta's real-estate vertical. The old
 *    value was "property", which is not a vertical Meta knows; a catalog would
 *    never have matched it.
 * 3. `eventID` belongs in fbq's FOURTH argument, not inside the event payload.
 *    Inside the payload it is just an unused custom parameter, and the
 *    deduplication it exists for — against a future Conversions API send of the
 *    same event — would silently not happen.
 */
type Props = {
  title: string;
  /** Development.id (UUID). NOT the view model's `id`, which is feedProjectId. */
  contentId: string;
  price?: number | null;
  city?: string;
  propertyType?: string;
};

export default function MetaViewContentTracker({ title, contentId, price, city, propertyType }: Props) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.fbq || !contentId) return;
    // Recomputed inside the effect: built at render time it would be baked into
    // a cached server payload and repeat across visitors, which is the opposite
    // of what a deduplication key is for.
    const eventId = `vc-${contentId}-${Date.now()}`;
    window.fbq(
      "track",
      "ViewContent",
      {
        content_name: title,
        content_ids: [contentId],
        content_type: "home_listing",
        value: typeof price === "number" ? price : 0,
        currency: "EUR",
        city: city || "",
        property_type: propertyType || "",
      },
      { eventID: eventId },
    );
  }, [title, contentId, price, city, propertyType]);

  return null;
}
