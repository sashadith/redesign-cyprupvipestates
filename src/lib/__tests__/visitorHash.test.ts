import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyticsSalt, dailyVisitorHash } from "@/lib/visitorHash";

/* Privacy T1 (2026-11-02): the visitor hash is keyed with a server secret. */

const day = new Date().toISOString().slice(0, 10);
const withDefault = (ip: string, ua: string) => crypto.createHash("sha256").update(`cvp|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);

test("a secret salt changes the hash: it can no longer be rebuilt from the public default", () => {
  const env = { ANALYTICS_SALT: "s3cret-from-env" } as any;
  const h = dailyVisitorHash("203.0.113.7", "Mozilla/5.0", env);
  assert.match(h, /^[0-9a-f]{32}$/);
  assert.notEqual(h, withDefault("203.0.113.7", "Mozilla/5.0"));
  assert.equal(h, dailyVisitorHash("203.0.113.7", "Mozilla/5.0", env), "stable within the day");
  assert.notEqual(h, dailyVisitorHash("203.0.113.8", "Mozilla/5.0", env));
});

test("no salt: the old default, so analytics keep counting — and production logs it once", () => {
  const errors: unknown[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
  try {
    assert.equal(analyticsSalt({ ANALYTICS_SALT: "  " } as any), "cvp");
    assert.equal(dailyVisitorHash("203.0.113.7", "UA", { NODE_ENV: "production" } as any), withDefault("203.0.113.7", "UA"));
    dailyVisitorHash("203.0.113.7", "UA", { NODE_ENV: "production" } as any);
  } finally {
    console.error = orig;
  }
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /ANALYTICS_SALT is not set/);
});

test("page views, page events and presentation views all hash through dailyVisitorHash", () => {
  for (const f of ["src/app/api/analytics/track/route.ts", "src/app/api/analytics/event/route.ts", "src/app/api/c/[token]/view/route.ts"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    assert.ok(src.includes("dailyVisitorHash("), f);
    assert.ok(!src.includes("ANALYTICS_SALT"), `${f} computes its own hash again`);
  }
});
