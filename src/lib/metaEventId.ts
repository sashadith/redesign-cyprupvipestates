/* Deduplication keys for Meta pixel events.
 *
 * Meta deduplicates a browser event against a Conversions API event when both
 * carry the same event name AND the same `event_id`, within 48 hours. Today
 * nothing is sent server-side, so these ids buy NOTHING on their own — that is
 * deliberate, and worth stating plainly rather than dressing up: they are the
 * prerequisite. A Conversions API switched on while the browser events are
 * anonymous would double-count every single conversion, and fixing it at that
 * point means touching all eighteen call sites again, under a live dataset.
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
export type MetaEventPrefix = "lead" | "contact" | "ic" | "vc";

export function newMetaEventId(prefix: MetaEventPrefix): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${rand}`;
}
