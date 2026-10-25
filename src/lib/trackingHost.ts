/**
 * Which hostnames may report to our third-party advertising tags.
 *
 * The Meta pixel id is compiled into the bundle (FacebookPixel.tsx), so until
 * 2026-10-22 any checkout of this repo reported into the production dataset the
 * moment someone opened a page. Meta's host breakdown measured it: on
 * 26 September, 10:00 PDT, `localhost` produced 310 events, 30 of them
 * InitiateCheckout — against 69 InitiateCheckout in the whole 28-day window.
 *
 * An allowlist by design. The set of hosts that must stay silent is open-ended
 * — 127.0.0.1, a LAN address, a tunnel, a preview port, a machine name, a
 * staging domain nobody has created yet — while the set that must report is
 * these two, and changes about once a decade. A blocklist of "localhost" is
 * already wrong for a developer who browses their dev server by IP.
 *
 * The consequence to keep in mind: adding a production domain to nginx without
 * adding it here means that domain silently reports nothing.
 */
export const TRACKING_HOSTS: readonly string[] = ["cyprusvipestates.com", "www.cyprusvipestates.com"];

/**
 * True only for a production hostname of THIS site.
 *
 * Exact match against the allowlist, never a suffix test: `endsWith` would
 * accept `evil-cyprusvipestates.com`, which anybody can register, and it would
 * also accept every subdomain — including `private.cyprusvipestates.com`, which
 * is a different application with its own copy of the pixel.
 */
export function isTrackingHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  // Browsers hand us a lowercase hostname already; normalising anyway means a
  // caller that passes a configured value or a Host header gets the same answer.
  // The trailing dot is the root label of a fully qualified name — same host.
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  return TRACKING_HOSTS.indexOf(host) !== -1;
}
