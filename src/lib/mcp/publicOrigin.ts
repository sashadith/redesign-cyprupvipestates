// The connector's own public base URL. Deliberately its own runtime env var:
// NEXT_PUBLIC_SITE_URL is build-time inlined and resolves to :3000 on the VPS
// (see src/lib/seo.ts), and the request Host header cannot be trusted without
// knowing nginx's proxy_set_header config, which lives outside this repo.
// Fail loud: a wrong origin here produces OAuth metadata that silently sends
// claude.ai to the wrong host.
export class McpConfigError extends Error {}

export function getMcpPublicOrigin(): string {
  const raw = process.env.MCP_PUBLIC_ORIGIN?.trim();
  if (!raw) throw new McpConfigError("MCP_PUBLIC_ORIGIN is not set (e.g. https://cyprusvipestates.com).");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new McpConfigError(`MCP_PUBLIC_ORIGIN is not an absolute URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new McpConfigError("MCP_PUBLIC_ORIGIN must be http(s).");
  if (url.pathname !== "/" || url.search || url.hash) throw new McpConfigError("MCP_PUBLIC_ORIGIN must be an origin only, no path.");
  return url.origin;
}
