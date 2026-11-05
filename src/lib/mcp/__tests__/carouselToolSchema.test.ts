import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/server";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { registerRenderInstagramCarousel } from "@/lib/mcp/tools/renderInstagramCarousel";

// The input schema (union of two strict data shapes, tuples, refinements) must
// survive the SDK's zod → JSON Schema conversion, or tools/list fails for every
// tool on the connector, not just this one.
test("render_instagram_carousel lists with a usable JSON schema", async () => {
  const server = new McpServer({ name: "t", version: "1" });
  registerRenderInstagramCarousel(server);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  const { tools } = await client.listTools();
  const t = tools.find((x) => x.name === "render_instagram_carousel");
  assert.ok(t, "tool listed");
  const schema = t!.inputSchema as any;
  assert.equal(schema.type, "object");
  for (const k of ["template", "lang", "slug", "data"]) assert.ok(schema.properties[k], `property ${k}`);
  assert.deepEqual(schema.properties.template.enum, ["project", "cyprus"]);
  assert.ok(JSON.stringify(schema.properties.data).includes("markedWords"));
  assert.equal(t!.annotations?.readOnlyHint, false);
  // claude.ai's connector drops a tool whose schema uses these (seen 2026-11-05).
  for (const kw of ["prefixItems", "exclusiveMinimum", "exclusiveMaximum", "$ref", "$defs"]) assert.ok(!JSON.stringify(schema).includes(`"${kw}"`), `schema must not use ${kw}`);
  await client.close();
});
