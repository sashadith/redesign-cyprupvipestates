// `producer | head -n N` inside a script that runs `set -o pipefail`.
//
// head closes the pipe after N lines. If the producer is still writing it gets
// SIGPIPE and exits 141; pipefail makes that the pipeline's status and set -e
// aborts the script. Whether the producer has finished first is a race, so the
// line works almost every time and then fails with no output and no message.
//
// This cost a production deploy on 2026-10-30. Release cve-20261030054024 built
// for thirteen minutes, passed both asset gates, and died at
// verify-www-data-access.sh's `find … | head -1` with status 141 — after
// `prisma migrate deploy` had already added a column, and before the symlink
// swap, so the migration was live and the code was not. Measured on the VPS
// against that release's 59-file css directory: 14 failures in 600 runs with
// head, 0 in 600 with `find -print -quit`.
//
// Two of the other instances sat AFTER the swap, where the same race would
// report a deploy that had actually worked as failed.
//
// The replacement is `sed -n`, which drains its input, so the producer never
// sees a closed pipe. This test fails on a new `| head` in any script that
// sets pipefail — reads the files, runs nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS = [
  "scripts/deploy-prod.sh",
  "scripts/deploy-staging.sh",
  "scripts/verify-www-data-access.sh",
  "scripts/verify-runtime-assets.sh",
];

test("no script that sets pipefail pipes into head", () => {
  const offenders: string[] = [];

  for (const rel of SCRIPTS) {
    let src: string;
    try {
      src = readFileSync(join(process.cwd(), rel), "utf8");
    } catch {
      continue; // a script that no longer exists cannot regress
    }
    if (!/set -[a-z]*o pipefail|set -o pipefail|set -euo pipefail/.test(src)) continue;

    src.split("\n").forEach((line, i) => {
      if (/^\s*#/.test(line)) return; // the explaining comments name `head` on purpose
      if (/\|\s*head\b/.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }

  assert.deepEqual(
    offenders,
    [],
    "A pipefail script pipes into head again. head closing the pipe can send the producer " +
      "SIGPIPE (141), which pipefail turns into a script abort — a ~2% race that killed " +
      "release cve-20261030054024 at the pre-swap gate, with the migration already applied. " +
      "Use `sed -n 1p` (it drains the pipe) or let the producer stop itself, e.g. " +
      "`find … -print -quit`:\n" + offenders.join("\n"),
  );
});

test("the pre-swap gate finds its sample without a pipe at all", () => {
  const src = readFileSync(join(process.cwd(), "scripts/verify-www-data-access.sh"), "utf8");
  assert.ok(
    /find .*-print -quit/.test(src),
    "verify-www-data-access.sh no longer uses `find -print -quit` to pick its sample file. " +
      "This gate runs after a full build and before the symlink swap: a spurious failure here " +
      "wastes the build and leaves a migration applied against code that never went live.",
  );
});
