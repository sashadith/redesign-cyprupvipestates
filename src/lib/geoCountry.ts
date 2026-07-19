import geoip from "geoip-lite";

// Looks up the ISO 3166-1 alpha-2 country for an IP at track time — the IP
// itself is never persisted, only this derived code (see track/route.ts).
export function lookupCountry(ip: string): string | null {
  if (!ip || ip === "0.0.0.0" || ip.startsWith("127.") || ip === "::1") return null;
  return geoip.lookup(ip)?.country ?? null;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
