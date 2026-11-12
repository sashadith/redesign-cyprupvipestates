import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_KEYS, TOOL_LABEL, isToolKey, seoAlertsOn } from "@/lib/toolSwitches";

test("exactly the two switchable tools, each with a label", () => {
  assert.deepEqual([...TOOL_KEYS], ["seo_advisor", "page_power"]);
  for (const k of TOOL_KEYS) assert.ok(TOOL_LABEL[k]);
});

test("isToolKey rejects anything else", () => {
  assert.equal(isToolKey("page_power"), true);
  assert.equal(isToolKey("seo_advisor"), true);
  assert.equal(isToolKey("Page_Power"), false);
  assert.equal(isToolKey(""), false);
  assert.equal(isToolKey("__proto__"), false);
});

// 2026-11-12: with SEO Advisor and Page Power both off, the operator still got
// an SEO section (ranking drops etc.) in the Action Center, email and Telegram.
test("general SEO alerts are off only when both tools are off", () => {
  assert.equal(seoAlertsOn(false, false), false);
  assert.equal(seoAlertsOn(true, false), true);
  assert.equal(seoAlertsOn(false, true), true);
  assert.equal(seoAlertsOn(true, true), true);
});

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("seoRules and the title-sweep push check the switch before doing anything", () => {
  const rules = src("src/lib/actionCenter/rules/seo.ts");
  const body = rules.slice(rules.indexOf("export async function seoRules"));
  assert.match(body, /if \(!\(await areSeoAlertsEnabled\(\)\)\) return staleCopyFigures\(\);/);
  assert.ok(body.indexOf("areSeoAlertsEnabled") < body.indexOf("rankingDrops()"));

  const sweep = src("src/lib/seo/titleSweepRemeasure.ts");
  const fn = sweep.slice(sweep.indexOf("export async function maybeSendTitleSweepTelegram"));
  assert.ok(fn.indexOf("areSeoAlertsEnabled") > -1 && fn.indexOf("areSeoAlertsEnabled") < fn.indexOf("sendTelegramMessage"));
});

test("stale figures in published copy stay visible under Developers, not SEO", () => {
  const rules = src("src/lib/actionCenter/rules/seo.ts");
  const fn = rules.slice(rules.indexOf("async function staleCopyFigures"), rules.indexOf("export async function seoRules"));
  assert.match(fn, /category: "DEVELOPERS"/);
});
