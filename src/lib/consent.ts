import Cookies from "js-cookie";

export const hasAnalyticsConsent = (): boolean => {
  const consent = Cookies.get("cookieConsent");
  if (!consent) return false;
  try {
    const parsed = JSON.parse(consent);
    return parsed.analytics === true;
  } catch {
    return false;
  }
};
