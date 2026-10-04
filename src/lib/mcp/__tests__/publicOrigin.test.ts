import { test } from "node:test";
import assert from "node:assert/strict";
import { getMcpPublicOrigin, McpConfigError } from "@/lib/mcp/publicOrigin";

test("returns the configured origin without a trailing slash", () => {
  process.env.MCP_PUBLIC_ORIGIN = "https://cyprusvipestates.com/";
  assert.equal(getMcpPublicOrigin(), "https://cyprusvipestates.com");
});

test("throws McpConfigError when unset or not an absolute http(s) URL", () => {
  delete process.env.MCP_PUBLIC_ORIGIN;
  assert.throws(() => getMcpPublicOrigin(), McpConfigError);
  process.env.MCP_PUBLIC_ORIGIN = "cyprusvipestates.com";
  assert.throws(() => getMcpPublicOrigin(), McpConfigError);
  process.env.MCP_PUBLIC_ORIGIN = "https://cyprusvipestates.com/admin";
  assert.throws(() => getMcpPublicOrigin(), McpConfigError); // path not allowed
});
