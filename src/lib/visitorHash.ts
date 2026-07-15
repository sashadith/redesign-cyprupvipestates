import crypto from "node:crypto";

/* Cookieless, daily-rotating visitor hash — no IP/PII stored, just enough to
   count unique sessions/days. Shared by PageView (src/app/api/analytics/track)
   and PresentationView (src/app/api/c/[token]/*) so both use the exact same
   formula. */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

export function dailyVisitorHash(ip: string, userAgent: string): string {
  const salt = process.env.ANALYTICS_SALT ?? "cvp";
  const day = new Date().toISOString().slice(0, 10); // UTC day → hash rotates daily
  return crypto.createHash("sha256").update(`${salt}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}
