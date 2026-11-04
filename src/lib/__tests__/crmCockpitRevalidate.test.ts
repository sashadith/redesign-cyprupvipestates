import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source-text pin (server actions cannot run without a DB): a logged contact
// refreshes the board too, not only the cockpit.
test("logging an interaction revalidates the cockpit and the pipeline", () => {
  const src = readFileSync("src/app/crm/leads/actions.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function logInteractionAction"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /revalidatePath\(`\/crm\/leads\/\$\{leadId\}`\)/);
  assert.match(body, /revalidatePath\("\/crm\/pipeline"\)/);
  assert.ok(body.indexOf('revalidatePath("/crm/pipeline")') > body.indexOf("await logLeadInteraction("), "only after a successful write");
});
