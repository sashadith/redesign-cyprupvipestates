"use client";

import { COOKIE_SETTINGS_EVENT } from "./cookieSettings";

/* Footer entry that reopens the consent banner (see cookieSettings.ts). A
   button, not a link: it navigates nowhere. Styled with the policy links in
   header-footer.css (.pf__policy > button). */
export default function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>
      {label}
    </button>
  );
}
