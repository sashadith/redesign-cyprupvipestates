import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrackingHost, TRACKING_HOSTS } from "@/lib/trackingHost";

/* Why this exists (2026-10-22). The Meta pixel id is compiled into
   FacebookPixel.tsx, and nothing used to ask which site the browser was on. So
   every developer running `npm run dev` wrote into the production dataset.
   Meta's own host breakdown shows it: on 26 September, 10:00 PDT, `localhost`
   produced 310 events — among them 30 InitiateCheckout, against 69
   InitiateCheckout in the entire 28-day window. Roughly two in five of that
   conversion's volume came from someone clicking through modals on a laptop,
   and every audience and optimisation built on it was trained on that.

   An allowlist, not a blocklist of "localhost": the hosts that must NOT report
   are open-ended (127.0.0.1, a LAN address, a tunnel, a colleague's machine
   name, a preview port, a future staging domain), while the hosts that must
   report are two and change about once a decade. A blocklist is wrong the day
   someone browses the dev server by IP. */

test("the two production hostnames report", () => {
  assert.equal(isTrackingHost("cyprusvipestates.com"), true);
  assert.equal(isTrackingHost("www.cyprusvipestates.com"), true);
});

test("nothing a developer or a preview runs on reports", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
    "0.0.0.0",
    "192.168.1.42",
    "10.0.0.7",
    "cvp.localhost",
    "cyprusvipestates.test",
    "72.60.89.239", // the VPS by IP — how a staging port gets browsed
    "staging.cyprusvipestates.com",
    "dev.cyprusvipestates.com",
    "preview.cyprusvipestates.com",
  ]) {
    assert.equal(isTrackingHost(host), false, `${host} must not write into the production dataset`);
  }
});

test("the other apps on the same domain keep their own datasets", () => {
  // private.cyprusvipestates.com is the Private Collection site (separate repo,
  // its own copy of the pixel component); design. and wa. are not this app at
  // all. Whether Private Collection should share this dataset is an open
  // question — this guard must not decide it by accident.
  assert.equal(isTrackingHost("private.cyprusvipestates.com"), false);
  assert.equal(isTrackingHost("design.cyprusvipestates.com"), false);
  assert.equal(isTrackingHost("wa.cyprusvipestates.com"), false);
});

test("a hostname that merely ends with ours does not count", () => {
  // The bug a naive endsWith() check would have: both of these pass
  // `h.endsWith("cyprusvipestates.com")`, and the second is a domain anybody
  // can register.
  assert.equal(isTrackingHost("notcyprusvipestates.com"), false);
  assert.equal(isTrackingHost("evil-cyprusvipestates.com"), false);
  // And the reverse shape: ours as a prefix of someone else's name.
  assert.equal(isTrackingHost("cyprusvipestates.com.attacker.net"), false);
});

test("the forms a browser can actually hand us still match", () => {
  assert.equal(isTrackingHost("CyprusVipEstates.com"), true, "hostname comparison is case-insensitive");
  assert.equal(isTrackingHost("cyprusvipestates.com."), true, "a fully qualified name with the root dot is the same host");
  assert.equal(isTrackingHost("  cyprusvipestates.com  "), true, "surrounding whitespace is not a different host");
});

test("absent or malformed input never reports", () => {
  for (const host of ["", "   ", ".", "undefined", "null"]) {
    assert.equal(isTrackingHost(host), false);
  }
  assert.equal(isTrackingHost(undefined), false);
  assert.equal(isTrackingHost(null), false);
});

test("the allowlist is exactly the two nginx server_name entries", () => {
  // /etc/nginx/sites-enabled/cyprusvipestates serves this app on these two and
  // nothing else. If a third production domain is ever added there, it has to
  // be added here too or it will silently stop reporting.
  assert.deepEqual(TRACKING_HOSTS.slice().sort(), ["cyprusvipestates.com", "www.cyprusvipestates.com"]);
});
