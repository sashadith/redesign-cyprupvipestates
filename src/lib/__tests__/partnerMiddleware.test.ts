import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerRewritePath } from "../partner/host";

const env = { PARTNER_HOST: "partner.cyprusvipestates.com", NODE_ENV: "production" };
const P = "partner.cyprusvipestates.com";

test("partner host root and nested paths are prefixed", () => {
  assert.equal(partnerRewritePath(P, "/", env), "/partner-portal");
  assert.equal(partnerRewritePath(P, "/login", env), "/partner-portal/login");
  assert.equal(partnerRewritePath(P, "/a/b", env), "/partner-portal/a/b");
  assert.equal(partnerRewritePath(P + ":443", "/home", env), "/partner-portal/home");
});

test("partner host paths already under /partner-portal are blocked", () => {
  assert.equal(partnerRewritePath(P, "/partner-portal", env), "block");
  assert.equal(partnerRewritePath(P, "/partner-portal/login", env), "block");
});

test("main host cannot reach /partner-portal", () => {
  assert.equal(partnerRewritePath("cyprusvipestates.com", "/partner-portal", env), "block");
  assert.equal(partnerRewritePath("cyprusvipestates.com", "/partner-portal/home", env), "block");
  assert.equal(partnerRewritePath(null, "/partner-portal/home", env), "block");
});

test("non-partner paths on the main host are untouched; lookalike prefix is not blocked", () => {
  assert.equal(partnerRewritePath("cyprusvipestates.com", "/en/projects", env), null);
  assert.equal(partnerRewritePath("cyprusvipestates.com", "/partner-portalx", env), null);
});

test("partner.localhost only outside production", () => {
  assert.equal(partnerRewritePath("partner.localhost:3000", "/x", { NODE_ENV: "development" }), "/partner-portal/x");
  assert.equal(partnerRewritePath("partner.localhost:3000", "/x", { NODE_ENV: "production" }), null);
});
