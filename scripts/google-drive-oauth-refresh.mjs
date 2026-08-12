#!/usr/bin/env node
// One-off local helper to mint a fresh Google Drive OAuth refresh token for
// the app's existing OAuth client (same GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
// already in the VPS's /var/www/shared/.env — only the refresh token itself
// gets replaced there afterward). Must run on whatever machine has a browser
// to complete Google's consent screen: the registered redirect URI is
// http://localhost:5858/callback, which only resolves on the machine
// actually running this listener.
//
// Usage:
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-drive-oauth-refresh.mjs
//
// Get the two values from the VPS (they don't live in this repo's local
// .env — Drive sync is a production-only feature):
//   ssh -i ~/.ssh/cvp_vps root@72.60.89.239 "grep -E '^GOOGLE_CLIENT_(ID|SECRET)=' /var/www/shared/.env"
//
// What it does:
//   1. Opens (or prints) Google's consent screen with access_type=offline +
//      prompt=consent — prompt=consent is required to get a NEW refresh
//      token even if this app was already authorized before; Google omits
//      it on a repeat consent otherwise.
//   2. Listens on http://localhost:5858/callback for the redirect.
//   3. Exchanges the returned code for tokens.
//   4. Prints ONLY the refresh_token — that's the one value that goes into
//      GOOGLE_REFRESH_TOKEN on the VPS. GOOGLE_CLIENT_ID/SECRET don't change.
//
// After updating /var/www/shared/.env, the running app must be restarted
// (env is only read at process boot) — see DEPLOYMENT.md / pm2 restart.
import http from "node:http";
import { execFile } from "node:child_process";
import { URL, URLSearchParams } from "node:url";

const PORT = 5858;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
// Read-only is all this app ever does with Drive (list/export/download —
// see src/lib/googleDrive.ts) — least-privilege scope, matches what the
// existing refresh token was almost certainly issued with.
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TIMEOUT_MS = 5 * 60_000;

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.\n");
  console.error("Usage:");
  console.error("  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-drive-oauth-refresh.mjs\n");
  console.error("Get both from the VPS (they're the SAME client — only the refresh token changes):");
  console.error("  ssh -i ~/.ssh/cvp_vps root@72.60.89.239 \"grep -E '^GOOGLE_CLIENT_(ID|SECRET)=' /var/www/shared/.env\"");
  process.exit(1);
}

function authorizeUrl() {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // forces a fresh refresh_token even on a repeat authorization
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function openBrowser(url) {
  // execFile, not exec — no shell involved, so nothing in `url` (built from
  // client_id/scope/redirect_uri above) is ever interpreted as shell syntax.
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(cmd, [url], () => {}); // best-effort — the URL is printed either way
}

async function exchangeCode(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  return json;
}

const html = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1B4B43}</style>
</head><body><h2>${title}</h2><p>${body}</p></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" }).end(html("Authorization failed", error));
    console.error(`\nGoogle returned an error: ${error}`);
    server.close();
    process.exitCode = 1;
    return;
  }
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" }).end(html("No code received", "Something went wrong — no authorization code in the callback."));
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    res.writeHead(200, { "Content-Type": "text/html" }).end(html("Done", "You can close this tab and go back to the terminal."));
    if (!tokens.refresh_token) {
      console.error("\nNo refresh_token in the response. This usually means Google didn't think a fresh one was");
      console.error("needed — try again after revoking the app's access at https://myaccount.google.com/permissions");
      console.error("(look for this app under Cyprus VIP Estates / its OAuth client name), then re-run this script.");
      console.error("\nFull response for reference:", JSON.stringify(tokens, null, 2));
      process.exitCode = 1;
    } else {
      console.log("\nGOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
      console.log("\nPut that into /var/www/shared/.env (replace the existing GOOGLE_REFRESH_TOKEN line only,");
      console.log("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET stay as they are), then restart the app so it's picked up:");
      console.log("  ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'pm2 restart cyprusvipestates'");
    }
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/html" }).end(html("Token exchange failed", String(e)));
    console.error("\nToken exchange failed:", e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  const url = authorizeUrl();
  console.log(`Listening on ${REDIRECT_URI}\n`);
  console.log("Opening your browser for Google's consent screen. If it doesn't open, visit:\n");
  console.log(url + "\n");
  openBrowser(url);
});

setTimeout(() => {
  console.error(`\nTimed out after ${TIMEOUT_MS / 60_000} minutes waiting for the callback — no consent completed.`);
  server.close();
  process.exit(1);
}, TIMEOUT_MS).unref();
