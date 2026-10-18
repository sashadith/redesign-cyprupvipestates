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
