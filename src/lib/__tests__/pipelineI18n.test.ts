import { test } from "node:test";
import assert from "node:assert/strict";
import { dict, lookup, PARTNER_LOCALES } from "@/lib/partner/i18n";
import { pipelineErrorKey } from "@/lib/partner/pipeline/errors";
import { NOT_IN_PIPELINE_KEY } from "@/lib/partner/pipeline/errors";

function shape(o: unknown, p = ""): string[] {
  if (typeof o === "string") return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, p ? `${p}.${k}` : k));
}

test("every pipeline.* key in en exists in de, pl and ru, and no value contains an exclamation mark", () => {
  const keys = shape((dict("en") as unknown as Record<string, unknown>).pipeline, "pipeline");
  assert.ok(keys.length > 20);
  for (const l of PARTNER_LOCALES) {
    for (const k of keys) {
      const v = lookup(l, k);
      assert.ok(v && v.trim(), `${l} ${k}`);
      assert.ok(!v.includes("!"), `${l} ${k}: ${v}`);
    }
  }
});

test("pipelineErrorKey maps the deal and lost-reason errors of moveLeadCore to pipeline.err.* keys", () => {
  for (const msg of [
    "Enter the deal: project, unit and price.",
    "Enter a valid price in whole euros.",
    "Project not found.",
    "Choose why the lead was lost.",
  ]) {
    const key = pipelineErrorKey(msg);
    assert.match(key, /^pipeline\.err\./);
    assert.notEqual(key, "pipeline.err.generic", msg);
    for (const l of PARTNER_LOCALES) assert.ok(lookup(l, key), `${l} ${key}`);
  }
});

test("pipelineErrorKey maps the pipeline keys and unknown text", () => {
  assert.equal(pipelineErrorKey("NOT_IN_PIPELINE"), NOT_IN_PIPELINE_KEY);
  assert.equal(pipelineErrorKey("DUPLICATE_CONTACT"), "pipeline.err.duplicateContact");
  assert.equal(pipelineErrorKey("Something nobody planned for."), "pipeline.err.generic");
  assert.equal(pipelineErrorKey(""), "pipeline.err.generic");
});

test("pipelineErrorKey maps the lead-edit validation texts to a known key", () => {
  for (const msg of [
    "First name is required.", "Enter a valid email address.", "Phone needs 6 to 20 digits.", "Add an email or a phone number",
    "Budget must be a whole number, 0 or more.", "Maximum budget cannot be below the minimum.", "Pick a salutation from the list.",
    "Nationality is too long (80 characters max).", "Country of residence is too long (80 characters max).",
    "viewingScheduledAt is required when setting status VIEWING_SCHEDULED.", "The date cannot be in the future.",
  ]) {
    const key = pipelineErrorKey(msg);
    assert.notEqual(key, "pipeline.err.generic", msg);
    for (const l of PARTNER_LOCALES) assert.ok(lookup(l, key), `${l} ${key}`);
  }
});
