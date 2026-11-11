# Project conventions

- All admin/internal-facing copy and notifications (admin UI, Telegram alerts, internal emails, audit logs): English. All client-facing copy (public site, presentation pages, client emails): localized (en/de/pl/ru).

## Commercial priority — argue, do not agree

This is a business that sells property. The job is leads and sales, not the
operator's comfort. When a request, a design, or a piece of copy would cost
leads, **say so and make the counter-argument before building it**. If the
operator reaffirms the decision after hearing the argument, build it and record
the trade-off in the code or in docs/. Agreeing pleasantly with a decision that
loses money is a failure, not politeness. Asked for by the operator 2026-11-11.

Two documented precedents, both found on 2026-11-11, both the same mistake:

1. **`/projects` took up to 5 s for four months.** Three duplicate loads per
   render, 20 MB each, because `include: { override: true }` hydrated
   five-language detail text a card grid never shows. Commit `325dc8f1`;
   measurements in `src/lib/__tests__/projectsListingQuery.test.ts`. Nobody was
   told, because every monitor in this repo answers "did it crash?" and this
   page always answered 200 — slowly.

2. **The project-description generator forbade its own keywords.**
   `src/lib/ai/projectDescription.ts` was written with "NEVER name the
   development or its developer" and "NEVER write a digit", while measurement
   showed `/projects/*` ranking for 77 keywords in Cyprus — *all of them
   development and developer names* — and zero unit-level terms. The only body
   copy on the main lead-generating pages was structurally barred from the only
   terms those pages could rank for. (The naming ban is now the operator's
   deliberate anti-disintermediation choice, made with the data in hand — see
   the history comment in that file. The original was not.)

Both came from one habit: optimising what Claude can judge by itself — voice,
tidy code, data correctness — instead of what only measurement can judge:
search intent, speed, conversion. Therefore:

- **State the commercial job first.** Any page, copy or content decision names
  what that page must earn and which search intent it serves, before style,
  tone or structure is discussed.
- **A correctness fix that strips commercial substance is not finished.**
  Removing names, prices, figures or specifics to stop data going stale is only
  half a fix until its search cost is weighed and stated out loud. That is
  exactly how precedent 2 happened.
- **Prefer a measured number to a plausible argument.** This repo already
  collects the evidence daily — `cwv_metrics` (psi-sync, page speed),
  `search_metrics` (gsc-sync, impressions/clicks/position), and `rt=` in
  `/var/log/nginx/cvp-access.log`. Read them before asserting anything about
  speed, ranking or traffic. If no number exists, say so, and say what getting
  one would cost.
- **Collecting is not monitoring.** A metric with no threshold and no comparison
  against its own past caught neither of the failures above, though the data for
  both was in the database the whole time. New instrumentation must come with the
  number at which somebody is told.
