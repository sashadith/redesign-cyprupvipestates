/* eslint-disable @next/next/no-img-element -- two small static brand PNGs at fixed CSS heights; the optimiser adds nothing. */
/**
 * Brand marks for the partner portal. Files live under /crm/brand/ on purpose: the middleware matcher
 * excludes /crm, so these static files are served as-is on the partner host instead of being rewritten.
 */
const ALT = "Cyprus VIP Estates";

/** Gold wordmark + mark (500×70). Sized by CSS (height), width follows the aspect ratio. */
export function LogoFull({ className }: { className?: string }) {
  return <img src="/crm/brand/logo-full.png" width={500} height={70} alt={ALT} className={className} decoding="async" />;
}

/** Gold mark alone (500×634). Sized by CSS (height). */
export function LogoMark({ className }: { className?: string }) {
  return <img src="/crm/brand/logo-mark.png" width={500} height={634} alt={ALT} className={className} decoding="async" />;
}
