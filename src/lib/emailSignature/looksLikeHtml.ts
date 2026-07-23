// Split out from sanitize.ts so client components (the signature editor's
// live preview) can import this one pure check without bundling
// sanitize-html itself into the client JS.
export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}
