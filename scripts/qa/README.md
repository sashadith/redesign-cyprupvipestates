# QA sweep

Pre-cutover verification for the self-hosted rebuild. Run these on the VPS so
`http://localhost` hits Nginx (port 80) and exercises the 301 redirect rules.

## 1. URL preservation (the #1 mandate)

Validates every production URL still resolves to a final `200` (following the
old-German → `/de/…` and `/` → `/en/` redirects).

```bash
bash scripts/qa/url-sweep.sh                              # staging, via Nginx
bash scripts/qa/url-sweep.sh https://cyprusvipestates.com # post-cutover
```

Expected: `SWEEP DONE: total=1293 ok=1293 fail=0`. Any non-200 lines are printed
with their status + path. `url-inventory-production.txt` is the canonical list
of URLs that must be preserved.

## 2. Smoke checks (read-only)

Language rendering (`<html lang>`), localized listings, sitemap/robots, admin
login, cron auth (`401`), analytics endpoint (bot UA → `204`, no row), images.

```bash
bash scripts/qa/smoke.sh
```

Makes no writes and sends no leads — safe to rerun.

## 3. Lead pipeline (manual — FIRES a real notification)

Not scripted here on purpose: a successful submission inserts a `Lead` **and
sends a real Telegram + email** to the office inbox, and needs DB cleanup after.
The route also requires a `Referer` matching the `currentPage` host, plus
honeypot/timing/rate-limit/allowed-host gates.

```bash
# On the VPS. Fires ONE test Telegram + email; delete the row afterward.
PAST=$(( $(date +%s) - 5 ))000
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'User-Agent: Mozilla/5.0 (QA)' \
  -H 'Referer: http://localhost/en/kontakt' -H 'Origin: http://localhost' \
  --data "{\"name\":\"QA-SWEEP\",\"surname\":\"Test\",\"email\":\"qa-valid@example.com\",\"phone\":\"+357000000\",\"message\":\"QA test - ignore\",\"currentPage\":\"http://localhost/en/kontakt\",\"formStartTime\":$PAST,\"lang\":\"en\"}" \
  http://localhost/api/leads

# Verify + clean up (run from the app dir so @prisma/client resolves):
node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.lead.findFirst({where:{email:"qa-valid@example.com"}}).then(async l=>{console.log("inserted:",!!l,l&&("telegram="+l.telegramNotified+" email="+l.emailNotified));await p.lead.deleteMany({where:{email:"qa-valid@example.com"}});await p.$disconnect()})'
```

Negative tests (no side effects): add `"fax":"bot"` (honeypot) or set
`formStartTime` to `now` (too fast) — both are silently rejected, no insert.
