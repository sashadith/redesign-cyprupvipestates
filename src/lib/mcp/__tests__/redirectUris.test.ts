import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedRedirectUri } from "@/lib/mcp/auth/redirectUris";

test("accepts https URLs on claude.ai / claude.com and their subdomains", () => {
  assert.equal(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isAllowedRedirectUri("https://app.claude.com/callback"), true);
  assert.equal(isAllowedRedirectUri("https://CLAUDE.AI/x"), true);
});

test("rejects other hosts, http, look-alikes and garbage", () => {
  assert.equal(isAllowedRedirectUri("http://claude.ai/callback"), false);
  assert.equal(isAllowedRedirectUri("https://claude.ai.evil.com/callback"), false);
  assert.equal(isAllowedRedirectUri("https://notclaude.ai/callback"), false);
  assert.equal(isAllowedRedirectUri("https://example.com/claude.ai"), false);
  assert.equal(isAllowedRedirectUri("not a url"), false);
  assert.equal(isAllowedRedirectUri(""), false);
});
