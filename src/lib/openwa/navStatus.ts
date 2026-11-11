/* The OpenWA gateway's session status, reduced to what a 104 px nav button can
 * show (2026-11-11, operator request).
 *
 * Why it exists: when the gateway loses its pairing, every WhatsApp lead alert
 * stops — website form, guide downloads, partner form, ROI calculator, Meta —
 * and only a QR scan in the gateway's own dashboard brings it back. It happened
 * on 2026-10-24 and again on 2026-11-11. Both times the watchdog
 * (api/cron/whatsapp-health) did send its Telegram at the first bad run and then
 * fell back to one message per six hours, which is correct for an alert and
 * useless as a status: on 11-11 the gateway had been dark for five and a half
 * hours and the admin looked exactly as it does when everything works.
 *
 * This is NOT a second watchdog. It raises nothing and notifies nobody; it only
 * paints the state that already exists onto the button you would click to fix
 * it. The alerting stays in sessionHealth.ts.
 *
 * `ok` here must agree with decideHealthAction()'s `ok` for the same status, or
 * the rail and the Telegram alerts would tell two different stories about the
 * same gateway — openwaNavStatus.test.ts holds them together.
 */

export type NavTone = "ok" | "warn" | "alarm" | "unknown";

export type OpenWaNavStatus = {
  tone: NavTone;
  /** Shown under the label when something is wrong. Empty while healthy — a working gateway needs no words. */
  short: string;
  /** The tooltip, and the drawer's second line. Admin copy: English. */
  label: string;
};

/** `null` = the gateway did not answer at all; "unconfigured" = no OPENWA_* env here. */
export function openwaNavStatus(status: string | null): OpenWaNavStatus {
  switch (status) {
    case "ready":
      return { tone: "ok", short: "", label: "WhatsApp gateway connected" };

    // A restart cannot fix these: WhatsApp wants the phone. Same two statuses
    // sessionHealth.ts sends the "pairing" alert for.
    case "qr_ready":
    case "action_required":
      return { tone: "alarm", short: "SCAN QR", label: "Not linked — scan the QR code with the business phone. No WhatsApp lead alerts until then." };

    case "failed":
      return { tone: "alarm", short: "FAILED", label: "The session failed. No WhatsApp lead alerts until it is back." };

    case null:
      return { tone: "alarm", short: "OFFLINE", label: "The gateway did not answer. No WhatsApp lead alerts until it is back." };

    // OpenWA reconnects by itself from `disconnected` (it did so in 15 s on
    // 2026-10-25), and the three start-up statuses are normal for a minute.
    // Amber, not red: nothing for a human to do yet.
    case "disconnected":
      return { tone: "warn", short: "RECONNECTING", label: "Disconnected — the gateway is reconnecting by itself." };
    case "created":
    case "initializing":
    case "authenticating":
      return { tone: "warn", short: "STARTING", label: "The session is starting up." };

    // No OPENWA_* variables in this environment (a dev machine, or a half-done
    // deploy). Deliberately NOT red: an alarm nobody can act on teaches people
    // to ignore the dot, and the button itself still works.
    case "unconfigured":
      return { tone: "unknown", short: "", label: "WhatsApp gateway not configured in this environment" };

    // A status this code has never seen. Amber and named, so it is visible
    // without pretending to know how bad it is.
    default:
      return { tone: "warn", short: "?", label: `Unknown gateway status: ${status}` };
  }
}
