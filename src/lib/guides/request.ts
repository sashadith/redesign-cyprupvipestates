import { getGuideContent, guideLangFor, isGuideId, type GuideId } from "./registry";
import { guideDownloadPath } from "./token";
import type { GuideLang } from "./types";

export type GuideRequest = {
  id: GuideId;
  lang: GuideLang;
  title: string;
};

/** Reads the optional `guide` field of a lead submission. Unknown ids are ignored (a plain enquiry). */
export function parseGuideRequest(body: { guide?: unknown }, langNorm: string): GuideRequest | null {
  if (!isGuideId(body.guide)) return null;
  const lang = guideLangFor(langNorm);
  return { id: body.guide, lang, title: getGuideContent(body.guide, lang).title };
}

/** The lead's message with the guide appended, so the team sees what was requested in the CRM, Telegram and e-mail. */
export function messageWithGuide(message: string, guide: GuideRequest | null): string {
  if (!guide) return message;
  return `${message ? message + "\n" : ""}[Guide] ${guide.title} (${guide.lang.toUpperCase()})`;
}

export function guideNote(guide: GuideRequest | null): string {
  return guide ? `Lead magnet: ${guide.id}` : "";
}

/** The signed relative download link for the response and the e-mail; null when signing is not configured. */
export function guideLink(guide: GuideRequest | null): string | null {
  if (!guide) return null;
  try { return guideDownloadPath(guide.id, guide.lang); } catch (e) { console.error("GUIDE_LINK_FAILED lead asked for a guide but the download link could not be signed:", e); return null; }
}
