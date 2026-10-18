/** Partner portal host detection (pure). Prod: env PARTNER_HOST; non-production also partner.localhost. */
export function isPartnerHost(
  host: string | null,
  env: { PARTNER_HOST?: string; NODE_ENV?: string },
): boolean {
  if (!host) return false;
  const norm = (x: string) => x.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const h = norm(host);
  if (!h) return false;
  const configured = norm(env.PARTNER_HOST ?? "");
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
