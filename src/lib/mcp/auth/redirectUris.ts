// Dynamic Client Registration accepts any client, so the redirect URI is the
// one thing that keeps an authorization code from landing somewhere other
// than claude.ai. Exact host match or a subdomain of the two Anthropic hosts;
// https only.
const ALLOWED_HOSTS = ["claude.ai", "claude.com"];

export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
