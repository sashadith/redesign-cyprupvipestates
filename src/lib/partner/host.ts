/** Partner portal host detection (pure). Prod: env PARTNER_HOST; non-production also partner.localhost. */
const MAIN_HOSTS = new Set(["cyprusvipestates.com", "www.cyprusvipestates.com"]);

export function isPartnerHost(
  host: string | null,
  env: { PARTNER_HOST?: string; NODE_ENV?: string },
): boolean {
  if (!host) return false;
  const norm = (x: string) => x.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const h = norm(host);
  if (!h) return false;
  const configured = norm(env.PARTNER_HOST ?? "");
  // Misconfiguration guard: PARTNER_HOST set to the main site must never turn the public site into the portal.
  if (MAIN_HOSTS.has(configured)) return false;
  if (configured && h === configured) return true;
  return env.NODE_ENV !== "production" && h === "partner.localhost";
}

/**
 * Where the middleware should send a request. Partner host → internal /partner-portal segment;
 * the main host must never reach that segment ("block" → 404 rewrite); otherwise null (not ours).
 */
export function partnerRewritePath(
  host: string | null,
  pathname: string,
  env: { PARTNER_HOST?: string; NODE_ENV?: string },
): string | null | "block" {
  const internal = pathname === "/partner-portal" || pathname.startsWith("/partner-portal/");
  if (isPartnerHost(host, env)) {
    if (internal) return "block";
    return "/partner-portal" + (pathname === "/" ? "" : pathname);
  }
  return internal ? "block" : null;
}

/**
 * The host the visitor actually asked for. A server action's redirect("/login") is rendered by an
 * internal fetch to Next's own localhost origin: the Host header is lost, X-Forwarded-Host survives.
 * Reading only Host sent that render to the main site's /login (its 404). nginx sets X-Forwarded-Host
 * to $host on every proxied request, so it is never client-controlled in production.
 */
export function routingHost(host: string | null, forwardedHost: string | null): string | null {
  const fwd = forwardedHost?.split(",")[0].trim();
  return fwd || host;
}
