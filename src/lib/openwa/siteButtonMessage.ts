// Recognises the text the site's WhatsApp buttons pre-fill (WhatAppButtonProject
// on project pages, WhatsAppButton everywhere else): a greeting, the line
// "I'm sending this message from the page:" in the visitor's language, the page
// URL, and an optional "(utm_source=…, ref=…)" tag (src/lib/attribution.ts
// attributionTag). Pure — no I/O — so the webhook can decide cheaply whether an
// unknown sender is a website enquiry worth a lead.
//
// The marker lines come from the button's own copy module rather than being
// retyped here: a reworded button must not silently stop producing leads.
import { messageWithUrl } from "@/app/components/WhatAppButtonProject/WhatAppButtonProject.copy";
import { LOCALES, type Locale } from "@/lib/locale";

export type SiteButtonMessage = {
  pageUrl: string;
  lang: Locale;
  /** Set when the page was a project page (/projects/<slug> or /<lang>/projects/<slug>). */
  projectSlug: string | null;
  utmSource: string | null;
  attributionRef: string | null;
};

// Visitors' apps and keyboards swap ' for ’ and back; compare on one form.
const norm = (s: string) => s.replace(/[’‘]/g, "'");

const MARKERS: Array<[Locale, string]> = (Object.entries(messageWithUrl) as Array<[Locale, string]>).map(([lang, full]) => [
  lang,
  norm(full.slice(full.lastIndexOf("\n") + 1)).trim(),
]);

// Only our own pages. A forwarded message quoting someone else's link is not an
// enquiry from this site.
const SITE_URL = /https?:\/\/(?:www\.)?cyprusvipestates\.com(\/[^\s)]*)?/i;

export function parseSiteButtonMessage(body: string | null | undefined): SiteButtonMessage | null {
  if (!body) return null;
  const text = norm(body);
  const hit = MARKERS.find(([, marker]) => text.includes(marker));
  if (!hit) return null;
  const [markerLang, marker] = hit;

  const after = text.slice(text.indexOf(marker) + marker.length);
  const m = after.match(SITE_URL);
  if (!m) return null;

  let url: URL;
  try {
    url = new URL(m[0]);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const pathLang = (LOCALES as readonly string[]).includes(segments[0] ?? "") ? (segments.shift() as Locale) : null;
  const projectSlug = segments[0] === "projects" && segments[1] ? decodeURIComponent(segments[1]).toLowerCase() : null;

  // The tag sits right after the URL; the URL's own query wins when both carry a value.
  const tag = after.slice(after.indexOf(m[0]) + m[0].length).match(/^\s*\(([^)]*)\)/)?.[1] ?? "";
  const fromTag = (key: string) => tag.match(new RegExp(`(?:^|,\\s*)${key}=([^,\\s]+)`))?.[1] ?? null;
  const clip = (v: string | null) => (v ? v.slice(0, 255) : null);

  return {
    pageUrl: url.toString().slice(0, 500),
    lang: pathLang ?? markerLang,
    projectSlug: projectSlug && /^[a-z0-9-]{1,120}$/.test(projectSlug) ? projectSlug : null,
    utmSource: clip(url.searchParams.get("utm_source") || fromTag("utm_source")),
    attributionRef: clip(url.searchParams.get("ref") || fromTag("ref")),
  };
}
