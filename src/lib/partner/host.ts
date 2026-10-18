/** Partner portal host detection (pure). Prod: env PARTNER_HOST; non-production also partner.localhost. */
export function isPartnerHost(
  host: string | null,
  env: { PARTNER_HOST?: string; NODE_ENV?: string },
): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (!h) return false;
  const configured = (env.PARTNER_HOST ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  if (configured && h === configured) return true;
  return env.NODE_ENV !== "production" && h === "partner.localhost";
}
