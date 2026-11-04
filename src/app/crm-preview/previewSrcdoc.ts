// CRM / portal preview panes of the owner's design page (controller ruling R10). nginx sends
// `X-Frame-Options: DENY`, so the panes cannot frame /crm-preview/* directly. The editor fetches
// that HTML once, turns it into a static srcdoc document (same-origin with the editor, no sandbox)
// and writes the draft into it as <style id="ds-draft">. No scripts run inside the panes.

const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const LINK = /<link\b[^>]*>/gi;
const HEAD = /<head(\s[^>]*)?>/i;

// <link rel="modulepreload"> or <link rel="preload" as="script">: useless without the scripts.
function isScriptPreload(tag: string): boolean {
  const rel = /\brel\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1]?.toLowerCase();
  if (rel === "modulepreload") return true;
  return rel === "preload" && /\bas\s*=\s*["']?script\b/i.test(tag);
}

// Strips every script and script preload, keeps stylesheets, font preloads and markup, and puts
// <base href="/"> first in <head> so root-relative URLs resolve on this origin. Idempotent.
export function toPreviewSrcdoc(html: string): string {
  let out = html.replace(SCRIPT, "").replace(LINK, (tag) => (isScriptPreload(tag) ? "" : tag));
  if (!/<base\s/i.test(out)) out = out.replace(HEAD, (head) => `${head}<base href="/">`);
  return out;
}

// The draft rule for <style id="ds-draft">. `vars` is cssVars() output, which never contains
// `{ } < >`; anything that does could close the rule or the element, so it is refused (null).
export function draftStyleText(vars: string): string | null {
  return /[{}<>]/.test(vars) ? null : `:root{${vars}}`;
}
