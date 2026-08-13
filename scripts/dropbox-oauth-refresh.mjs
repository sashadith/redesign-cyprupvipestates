#!/usr/bin/env node
// One-off local helper to mint a Dropbox OAuth refresh token for Kuutio's
// public-share-link sync (files/list_folder + files/download with the
// `shared_link` parameter — see DEPLOYMENT.md / driveAvailabilitySync.ts's
// Dropbox provider). Same pattern as scripts/google-drive-oauth-refresh.mjs:
// this app's token works against ANY publicly shared Dropbox link, so the
// account you authorize with here does NOT need to be Kuutio's — any
// Dropbox account works, this is purely to mint a token for OUR app.
//
// Usage:
//   DROPBOX_APP_KEY=... DROPBOX_APP_SECRET=... node scripts/dropbox-oauth-refresh.mjs
//
// Get both from https://www.dropbox.com/developers/apps → your app → Settings tab
// (App key / App secret).
//
// Before running this, in the Dropbox App Console:
//   1. Create app → "Scoped access" → access type "App folder" (we never touch
//      the authorizing account's own storage, only public share links via
//      `sharing.read` — App folder is the more restrictive/least-privilege
//      choice and works fine for that).
//   2. Permissions tab: enable `sharing.read`, `files.metadata.read`,
//      `files.content.read`. Submit.
//   3. Settings tab → OAuth 2 → Redirect URIs: add exactly
//      http://localhost:5859/callback (this script's local listener).
//
// What it does:
//   1. Opens (or prints) Dropbox's consent screen with token_access_type=offline
//      (Dropbox's equivalent of Google's access_type=offline) — required to get
//      a refresh_token back, not just a short-lived access_token.
//   2. Listens on http://localhost:5859/callback for the redirect.
//   3. Exchanges the returned code for tokens.
//   4. Prints ONLY the refresh_token — that's the one value that goes into
//      DROPBOX_REFRESH_TOKEN on the VPS. DROPBOX_APP_KEY/SECRET don't change
//      (same two values you already used to run this script).
//
// After updating /var/www/shared/.env, the running app must be restarted
// (env is only read at process boot) — see DEPLOYMENT.md / pm2 restart.
import http from "node:http";
import { execFile } from "node:child_process";
import { URL, URLSearchParams } from "node:url";

const PORT = 5859; // deliberately different from Google's 5858 — never run both at once, but avoids any confusion in the two apps' redirect URI registration
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "sharing.read files.metadata.read files.content.read"; // least-privilege — read-only, matches the app's Permissions tab
const TIMEOUT_MS = 5 * 60_000;

const appKey = process.env.DROPBOX_APP_KEY;
const appSecret = process.env.DROPBOX_APP_SECRET;

if (!appKey || !appSecret) {
  console.error("Missing DROPBOX_APP_KEY / DROPBOX_APP_SECRET.\n");
  console.error("Usage:");
  console.error("  DROPBOX_APP_KEY=... DROPBOX_APP_SECRET=... node scripts/dropbox-oauth-refresh.mjs\n");
  console.error("Get both from https://www.dropbox.com/developers/apps -> your app -> Settings tab.");
  process.exit(1);
}

function authorizeUrl() {
  const params = new URLSearchParams({
    client_id: appKey,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    token_access_type: "offline", // Dropbox's access_type=offline equivalent — required for a refresh_token
    scope: SCOPE,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

function openBrowser(url) {
  // execFile, not exec — no shell involved, so nothing in `url` (built from
  // client_id/scope/redirect_uri above) is ever interpreted as shell syntax.
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(cmd, [url], () => {}); // best-effort — the URL is printed either way
}

async function exchangeCode(code) {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      client_secret: appSecret,
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
    console.error(`\nDropbox returned an error: ${error}`);
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
      console.error("\nNo refresh_token in the response — token_access_type=offline should always return one on a first");
      console.error("consent. If you'd already authorized this app before, revoke it first at");
      console.error("https://www.dropbox.com/account/connected_apps, then re-run this script.");
      console.error("\nFull response for reference:", JSON.stringify(tokens, null, 2));
      process.exitCode = 1;
    } else {
      console.log("\nDROPBOX_REFRESH_TOKEN=" + tokens.refresh_token);
      console.log("\nPut that into /var/www/shared/.env alongside DROPBOX_APP_KEY/DROPBOX_APP_SECRET (all three are");
      console.log("new — this is the first Dropbox setup), then restart the app so it's picked up:");
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
  console.log("Opening your browser for Dropbox's consent screen. If it doesn't open, visit:\n");
  console.log(url + "\n");
  openBrowser(url);
});

setTimeout(() => {
  console.error(`\nTimed out after ${TIMEOUT_MS / 60_000} minutes waiting for the callback — no consent completed.`);
  server.close();
  process.exit(1);
}, TIMEOUT_MS).unref();
