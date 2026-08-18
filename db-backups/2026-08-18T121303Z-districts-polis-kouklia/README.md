# Pre-change snapshot — Polis/Kouklia district rollout

Taken immediately before the two production writes:

1. `scripts/clear-stale-district-overrides.mjs --apply` — clears
   DevelopmentOverride.district on 4 rows (Argaka Village 6, Grigio Court,
   Imperial Residences, Royal Residences).
2. `scripts/backfill-development-districts.mjs --apply --only=reclass` —
   rewrites Development.district on the reclassified rows.

## Reversal

- `developments-district.json` — id + district for every development.
- `overrides-district.json` — every DevelopmentOverride that had a district set.

Both writes touch exactly one column each, so restoring means writing these
values back by id. The backfill is idempotent, so a partial failure is safe to
re-run rather than reverse.
