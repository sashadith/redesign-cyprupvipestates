import crypto from "node:crypto";

/* Cookieless, daily-rotating visitor hash — no IP stored, just enough to
   count unique sessions/days. Shared by PageView (src/app/api/analytics/track),
   PageEvent (…/analytics/event) and PresentationView (src/app/api/c/[token]/*)
   so all three use the exact same formula.

   The salt is a server secret (ANALYTICS_SALT in /var/www/shared/.env, privacy
   T1 2026-11-02). With the old public default anyone holding a row could
   rebuild the hash from a guessed IP + browser; with a secret only the server
   can, and the date in the input still makes every day's hash a new one. A
   production process without the secret keeps counting (the default stays,
   so a missing line never breaks analytics) but says so in the log. */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

const DEFAULT_SALT = "cvp";
let warned = false;

export function analyticsSalt(env: NodeJS.ProcessEnv = process.env): string {
  const salt = env.ANALYTICS_SALT?.trim();
  if (salt) return salt;
  if (env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.error("ANALYTICS_SALT is not set — visitor hashes use the public default salt (see src/lib/visitorHash.ts)");
  }
  return DEFAULT_SALT;
}

export function dailyVisitorHash(ip: string, userAgent: string, env: NodeJS.ProcessEnv = process.env): string {
  const salt = analyticsSalt(env);
  const day = new Date().toISOString().slice(0, 10); // UTC day → hash rotates daily
  return crypto.createHash("sha256").update(`${salt}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}
