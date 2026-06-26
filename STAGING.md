# Staging — redesign preview online

**URL:** https://design.cyprusvipestates.com  (HTTP Basic Auth — credentials shared
privately, **not** in this repo). Redesign preview: `/preview-home`.

## What's deployed

- Separate PM2 app **`cve-staging`** on `127.0.0.1:3200` — the live
  `cyprusvipestates` app is never touched.
- App dir on the VPS: `/var/www/cve-staging` (its `node_modules` and
  `public/uploads` are symlinked from production; it has its own `.env`).
- nginx vhost `design.cyprusvipestates.com` → Let's Encrypt SSL (auto-renew).

## Protected from indexing / public access (all three)

1. **HTTP Basic Auth** — nginx `auth_basic` + `/etc/nginx/.htpasswd-staging`.
2. **`X-Robots-Tag: noindex, nofollow`** on every response.
3. **`robots.txt`** → `Disallow: /` (served openly so crawlers read it).

## Deploy / update staging

From a local checkout of the latest code:

```bash
git checkout redesign/home && git pull --ff-only
./scripts/deploy-staging.sh          # rsync → build → pm2 reload cve-staging
```

Requires VPS SSH access (`~/.ssh/cvp_vps`). The script never runs
`pm2 reload all` — only `cve-staging`.

## Notes

- Staging uses the **production database** (read-mostly) so it renders real
  content. Lead delivery is **disabled** on staging (`MONDAY_API_KEY` /
  `TELEGRAM_BOT_TOKEN` blanked) so form tests don't reach the real CRM.
- The local-only `next.config` hacks (`/uploads` proxy, unoptimized images) are
  **off** on staging — it serves real `/uploads` from disk with full image
  optimization (gated behind `LOCAL_PREVIEW`, which staging does not set).

## Branch flow → staging

`feature → PR → redesign/home → push → deploy-staging.sh → review on
design.cyprusvipestates.com`. Merge toward `main` (production) only after sign-off.
