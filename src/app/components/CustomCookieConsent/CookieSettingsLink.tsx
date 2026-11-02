"use client";

import { COOKIE_SETTINGS_EVENT } from "./cookieSettings";

/* Footer entry that reopens the consent banner (see cookieSettings.ts). A
   button, not a link: it navigates nowhere. Styled with the policy links in
   header-footer.css (.pf__policy > button). */
export default function CookieSettingsLink({ label, englishFallback = false }: { label: string; englishFallback?: boolean }) {
  return (
    <button
      type="button"
      // An English label on a Hebrew page: tell screen readers and the bidi algorithm.
      {...(englishFallback ? { lang: "en", dir: "ltr" } : {})}
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
    >
      {label}
    </button>
  );
}
