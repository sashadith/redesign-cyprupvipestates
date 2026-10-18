import { test } from "node:test";
import assert from "node:assert/strict";
import { isPartnerHost } from "@/lib/partner/host";

const prod = { PARTNER_HOST: "partner.cyprusvipestates.com", NODE_ENV: "production" };
const dev = { PARTNER_HOST: "partner.cyprusvipestates.com", NODE_ENV: "development" };

test("partner host: prod host, with port and uppercase", () => {
  assert.equal(isPartnerHost("partner.cyprusvipestates.com", prod), true);
  assert.equal(isPartnerHost("partner.cyprusvipestates.com:443", prod), true);
  assert.equal(isPartnerHost("PARTNER.CyprusVIPEstates.com", prod), true);
});
test("partner host: trailing dot is ignored on host and config", () => {
  assert.equal(isPartnerHost("partner.cyprusvipestates.com.", prod), true);
  assert.equal(isPartnerHost("partner.cyprusvipestates.com:443", { ...prod, PARTNER_HOST: "partner.cyprusvipestates.com." }), true);
});
test("partner host: partner.localhost only outside production", () => {
  assert.equal(isPartnerHost("partner.localhost:3000", dev), true);
  assert.equal(isPartnerHost("partner.localhost", { NODE_ENV: "test" }), true);
  assert.equal(isPartnerHost("partner.localhost", prod), false);
});
test("partner host: main host, null, empty and unset env are false", () => {
  assert.equal(isPartnerHost("cyprusvipestates.com", prod), false);
  assert.equal(isPartnerHost(null, prod), false);
  assert.equal(isPartnerHost("", prod), false);
  assert.equal(isPartnerHost("anything.com", { NODE_ENV: "production" }), false);
});
