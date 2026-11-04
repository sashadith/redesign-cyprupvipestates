/* Deduplication keys for Meta pixel events.
 *
 * Meta deduplicates a browser event against a Conversions API event when both
 * carry the same event name AND the same `event_id`, within 48 hours. Today
 * Lead and Contact also go out server-side (src/lib/metaCapi.ts, 2026-11-01):
 * the browser posts the same id to our API, and that is the only reason the
 * two copies count once. FormOpen ("fo", formerly InitiateCheckout) and
 * ViewContent stay browser-only, the ids there cost nothing and keep the shape
 * uniform.
 *
 * Two rules the call sites must keep, both learned the hard way in this repo:
 *
 * 1. Build the id at SEND time. MetaViewContentTracker's comment records why:
 *    an id computed during render is baked into a cached server payload and
 *    then repeats across every visitor who is served that page, which is the
 *    exact opposite of what a deduplication key is for.
 * 2. Pass it as fbq's FOURTH argument (`{ eventID }`), never inside the event
 *    payload — there it is an unused custom parameter and the deduplication
 *    silently does not happen.
 *
 * Not a UUID: `crypto.randomUUID()` needs a secure context, and the one thing
 * this value must never do is throw inside a form's success handler. Date plus
 * randomness is enough, because uniqueness is the only property required — the
 * id is generated in the browser and travels to the server from there, so the
 * two sides never have to derive the same value independently.
 */

/** Prefixes in use, so a key read in Events Manager says which event it came from. */
export type MetaEventPrefix = "lead" | "contact" | "fo" | "vc";

export function newMetaEventId(prefix: MetaEventPrefix): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${rand}`;
}
