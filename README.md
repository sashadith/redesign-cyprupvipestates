# Cyprus VIP Estates — Website

Next.js 14 (App Router) + Prisma/PostgreSQL. Multilingual (EN canonical, DE/PL/RU).
Production runs on a Hostinger VPS; this repo is also the home of the **homepage
redesign** (branch `redesign/home`).

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
git clone https://github.com/sashadith/cve.git
cd cve
git checkout redesign/home          # design work lives here
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

| Route | What |
|-------|------|
| `/preview-home` | The restyled homepage (in progress) |
| `/sandbox`, `/sandbox-v2…v5` | Design-system explorations (V5 = chosen direction) |

All preview routes are `noindex` and bypass the i18n middleware. The live
homepage (`src/app/[lang]/page.tsx`) and its components are **untouched** — the
redesign uses preview-scoped copies under `src/app/preview-home/`.

---

## Collaboration workflow

- **`main`** — stable / what production runs. Never commit WIP directly here.
- **`redesign/home`** — the homepage redesign (current working branch).
- **Feature branches** — branch off `redesign/home` (e.g. `redesign/home-faq`),
  open a PR back into it.

Every session:

```bash
git checkout redesign/home
git pull --ff-only        # get your colleague's latest work BEFORE you start
# …work…
git add -p && git commit -m "feat(redesign): …"
git push                  # push to GitHub
```

Then preview online on **staging** (see `STAGING.md`). Open a PR for review
before anything merges toward `main`.

**Do not** deploy the redesign branch to production — production is the live
site. Staging is the safe preview.

---

## Sensitive files (never committed — already in `.gitignore`)

`.env`, `.env.*` (except `.env.example`), `.env.local`, `/node_modules`,
`/.next`, `.local-db/`, `*.sql` content dumps, `/public/uploads`.
