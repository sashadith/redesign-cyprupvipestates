# Cyprus VIP Estates — Website

Next.js 14 (App Router) + Prisma/PostgreSQL. Multilingual (EN canonical, DE/PL/RU).
Production runs on a Hostinger VPS. `main` is the live branch — what's on
`main` is what production runs (see `DEPLOYMENT.md` for the full deploy
workflow). The former `redesign/home` branch (the homepage redesign) was
merged into `main` on 2026-07-18 and is kept around temporarily for reference
only — do not branch off it or push to it.

---

## Prerequisites

| Tool | Version |
|------|---------|
| **Node.js** | **20.20.2** (match prod; use `nvm`/`fnm`/Volta) |
| npm | 10.x |
| PostgreSQL | 16.x (local, for content) |

> Tip: `nvm install 20.20.2 && nvm use`.

---

## 1. Install

```bash
git clone git@github.com:sashadith/redesign-cyprupvipestates.git cve
cd cve                              # main checks out by default
npm install --legacy-peer-deps      # legacy flag is required (peer-dep conflicts)
```

## 2. Environment (`.env.local`)

`.env.local` is **git-ignored** — create your own. Minimum needed to run the
redesign preview locally:

```bash
DATABASE_URL="postgresql://USER@localhost:5433/cyprusvipestates?schema=public"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
AUTH_SECRET="any-32+char-string-for-local"
AUTH_URL="http://localhost:3000"
LOCAL_PREVIEW=1   # serves /uploads from production + unoptimized images (DEV ONLY)
```

See **`.env.example`** for the full production variable list (DB, NextAuth,
SMTP, Telegram, Monday, cron, analytics). Never commit a filled env file.

## 3. Local content database

The homepage renders from Postgres. Get a **content-only** dump (no PII —
excludes `leads`, `users`, `sessions`, `page_views`) — shared out-of-band, **not
in git**. Then, with a local Postgres on port **5433**:

```bash
createdb -p 5433 cyprusvipestates
psql -p 5433 -d cyprusvipestates -f cve_content.sql
```

(To regenerate the dump from the VPS — read-only, never modifies the server:
`pg_dump "$DATABASE_URL_NO_QUERYSTRING" --no-owner --no-privileges \
  --exclude-table-data=public.leads --exclude-table-data=public.users \
  --exclude-table-data=public.sessions --exclude-table-data=public.page_views \
  -f cve_content.sql`)

Media (`/uploads`) is **not** stored in git — in dev it's proxied from
production automatically via `LOCAL_PREVIEW=1`.

## 4. Run

```bash
npm run dev      # http://localhost:3000  · redesign preview: /preview-home
npm run build    # production build (no LOCAL_PREVIEW)
npm run start    # serve the production build
npm run lint
```

---

## Where the redesign lives

The homepage redesign shipped to production on 2026-07-18 — `src/app/[lang]/page.tsx`
and its `src/app/preview-home/` section components ARE the live homepage now,
despite the folder name. A few other still-in-progress redesigns keep their
own isolated `preview-*` route trees (rewritten from their public URL by
`src/middleware.ts` — see that file for which ones):

| Route | What |
|-------|------|
| `/preview-case-studies`, `/preview-faq`, `/preview-partners` | Isolated redesign previews, live at their public URL via a middleware rewrite |
| `/sandbox`, `/sandbox-v2…v5` | Design-system explorations (V5 = the direction the shipped redesign is based on) |

All `/preview-*` routes are `noindex`.

---

## Collaboration workflow

- **`main`** — the live branch. What's on `main` is what `deploy-prod.sh`
  ships to production. Never commit WIP directly here.
- **Feature branches** — branch off `main` for any new work, open a PR back
  into it.

Every session:

```bash
git checkout -b feat/my-change main
git pull --ff-only origin main   # get the latest before you start
# …work…
git add -p && git commit -m "feat: …"
git push -u origin feat/my-change
```

Then preview on **staging** (see `DEPLOYMENT.md`) by checking out your feature
branch and running `./scripts/deploy-staging.sh`. Open a PR for review before
merging to `main`; `main` is what `deploy-prod.sh` deploys by default.

---

## Sensitive files (never committed — already in `.gitignore`)

`.env`, `.env.*` (except `.env.example`), `.env.local`, `/node_modules`,
`/.next`, `.local-db/`, `*.sql` content dumps, `/public/uploads`.
