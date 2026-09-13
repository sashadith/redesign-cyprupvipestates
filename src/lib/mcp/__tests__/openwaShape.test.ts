import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeThread } from "@/lib/openwa/shapeMessages";

const at = 1787904455; // 2026-08-28

test("shapeThread: drops the empty 'unknown' sync artefacts", () => {
  const out = shapeThread([
    { body: "real message", type: "text", timestamp: at, fromMe: false },
    { body: "", type: "unknown", timestamp: at + 10, fromMe: false },
  ]);
  assert.equal(out.length, 1);
  assert.ok(typeof out[0].text === "object" && out[0].text !== null);
  assert.equal((out[0].text as { untrusted_content: string }).untrusted_content, "real message");
});

test("shapeThread: keeps an 'unknown' row that actually carries text", () => {
  const out = shapeThread([{ body: "hello", type: "unknown", timestamp: at, fromMe: true }]);
  assert.equal(out.length, 1);
});

test("shapeThread: media becomes a marker, never bytes", () => {
  const out = shapeThread([
    { body: "", type: "image", timestamp: at, fromMe: false, metadata: { media: { mimetype: "image/jpeg", sizeBytes: 153_000 } } },
  ]);
  assert.deepEqual(out[0].media, { type: "image", mimetype: "image/jpeg", sizeBytes: 153_000 });
  assert.strictEqual(out[0].text, null);
});

test("shapeThread: outbound text is not wrapped as untrusted, inbound is", () => {
  const out = shapeThread([
    { body: "from them", type: "text", timestamp: at, fromMe: false },
    { body: "from us", type: "text", timestamp: at + 1, fromMe: true },
  ]);
  assert.equal(out[0].direction, "IN");
  assert.ok(out[0].text !== null && typeof out[0].text === "object" && "untrusted_content" in out[0].text);
  assert.equal(out[1].direction, "OUT");
  assert.equal(out[1].text, "from us");
});

test("shapeThread: returns oldest first regardless of input order", () => {
  const out = shapeThread([
    { body: "second", type: "text", timestamp: at + 100, fromMe: true },
    { body: "first", type: "text", timestamp: at, fromMe: true },
  ]);
  assert.deepEqual(out.map((m) => m.text), ["first", "second"]);
});

test("shapeThread: a row without a timestamp is dropped rather than dated now", () => {
  assert.equal(shapeThread([{ body: "x", type: "text", timestamp: null, fromMe: true }]).length, 0);
});
