import { newMetaEventId } from "@/lib/metaEventId";

/* The Meta "Contact" event, browser and server copy in one call (2026-11-01).
 *
 * The browser half is the fbq call every contact link used to make itself. The
 * server half is a beacon to /api/meta/contact carrying the SAME event id, so
 * Meta counts the pair once; the route re-checks consent before forwarding.
 *
 * Nothing at all happens without the pixel: `window.fbq` exists only after
 * consent, on a production host, for a visitor who is not an automated
 * browser, so the beacon inherits every one of those gates for free. A beacon
 * because the click navigates away (wa.me, tel:) and a fetch would be cut off. */

export type ContactData = { method: string; placement: string; page_location: string };

export function trackMetaContact(data: ContactData): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;
  const eventId = newMetaEventId("contact");
  fbq("track", "Contact", data, { eventID: eventId });
  try {
    const payload = JSON.stringify({ eventId, url: window.location.href, method: data.method, placement: data.placement });
    navigator.sendBeacon?.("/api/meta/contact", new Blob([payload], { type: "application/json" }));
  } catch { /* tracking must never break a contact click */ }
}
