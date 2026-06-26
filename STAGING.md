# Staging — redesign preview online

Goal: preview the `redesign/home` branch on a protected subdomain, isolated from
the live site, **never indexed**.

## Topology (recommended)

A **separate PM2 app** on the VPS, on its own port, behind an **nginx subdomain**
— it does not touch the production `cyprusvipestates` app.

```
design.cyprusvipestates.com  ──nginx──▶  127.0.0.1:3200  (pm2: cve-staging)
cyprusvipestates.com         ──nginx──▶  127.0.0.1:3000  (pm2: cyprusvipestates, LIVE)
```

- **Subdomain:** `design.cyprusvipestates.com` (needs a DNS A-record → VPS IP `72.60.89.239`).
- **App dir:** `/var/www/cve-staging` (separate from production).
- **DB:** points at the existing production Postgres **read-mostly** (staging
  renders real content). Use a dedicated read-only role if you want extra safety.
- **No `LOCAL_PREVIEW`** — staging serves `/uploads` from disk and uses real image optimization.

## Protect from indexing (all three)

1. **nginx** server-level header on the staging block:
   `add_header X-Robots-Tag "noindex, nofollow" always;`
2. **robots.txt** for staging: `User-agent: *` / `Disallow: /`.
3. **Basic Auth** (optional but recommended) via nginx `auth_basic` + an htpasswd file.

(The redesign preview routes already send `noindex` meta, but the header+robots
cover the whole staging host.)

## Manual deploy (each update)

```bash
# 1. from local — push first
git push

# 2. on the VPS
ssh -i ~/.ssh/cvp_vps root@72.60.89.239
cd /var/www/cve-staging
git fetch origin && git checkout redesign/home && git pull --ff-only
npm install --legacy-peer-deps
npm run build
pm2 reload cve-staging --update-env     # never `pm2 reload all`
```

First-time setup (one-off): `git clone` into `/var/www/cve-staging`, create its
`.env` (DATABASE_URL, AUTH_SECRET, `AUTH_URL=https://design.cyprusvipestates.com`,
SMTP/Telegram/etc. as needed), `pm2 start ... --name cve-staging -- start -p 3200`,
add the nginx server block + Let's Encrypt cert + the noindex header + basic auth.

## Optional: auto-deploy from GitHub

A GitHub Action on push to `redesign/home` SSHes to the VPS and runs the deploy
block above. Needs repo secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. Provide
those and a workflow file (`.github/workflows/staging.yml`) can be added.

## Branch flow → staging

`feature → PR → redesign/home → push → staging build → review on design.cyprusvipestates.com`.
Only merge toward `main` (production) after design sign-off.
