import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApprovalCode, normalizeApprovalCode, approvalCodesMatch, APPROVAL_CODE_ALPHABET } from "@/lib/mcp/drafts/approvalCode";

test("codes are 6 chars from the unambiguous alphabet and vary", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generateApprovalCode();
    assert.equal(c.length, 6);
    for (const ch of c) assert.ok(APPROVAL_CODE_ALPHABET.includes(ch), `bad char ${ch}`);
    seen.add(c);
  }
  assert.ok(seen.size > 190);
  assert.doesNotMatch(APPROVAL_CODE_ALPHABET, /[0O1I]/);
});

test("comparison is case- and separator-insensitive, never loose", () => {
  assert.equal(normalizeApprovalCode(" 7k3p-q2 "), "7K3PQ2");
  assert.equal(approvalCodesMatch("7k3p q2", "7K3PQ2"), true);
  assert.equal(approvalCodesMatch("7K3PQ3", "7K3PQ2"), false);
  assert.equal(approvalCodesMatch("", "7K3PQ2"), false);
  assert.equal(approvalCodesMatch("7K3PQ", "7K3PQ2"), false);
});
