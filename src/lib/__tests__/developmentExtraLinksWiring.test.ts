// The wiring around the extra-link buttons. Every failure this guards against
// is silent — nothing throws, nothing type-errors, the page just quietly
// behaves differently than intended:
//
//  - the admin field name and the name the save action reads must match, or
//    saving appears to work and stores nothing (the Marinakis `--live` class of
//    bug: right protection, wrong scope, exit code 0);
//  - the anchor needs noopener (the target page gets window.opener otherwise)
//    and nofollow (the operator allowed pointing at the developer's own site on
//    2026-10-30; our link equity following it there was never part of that);
//  - the buttons must sit outside the `p.description &&` conditional, or a
//    project with links and no copy yet shows none of them;
//  - the CSS classes must exist, or the pills render as bare links and
//    .pp-sr's "opens in a new tab" becomes visible body text.
//
// Reads the source; no DB, no React, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const BODY = "src/app/preview-project/ProjectPageBody.tsx";
const CSS = "src/app/preview-project/project.css";
const FIELD = "src/app/admin/(panel)/developments/[id]/ExtraLinksField.tsx";
const ACTION = "src/app/admin/(panel)/developments/[id]/actions.ts";
const RENDER = "src/lib/developmentRender.ts";
const SCHEMA = "prisma/schema.prisma";

test("the admin input name is the one the save action reads", () => {
  const field = read(FIELD);
  const action = read(ACTION);
  const named = /name="extraLinks"/.test(field);
  const readBack = /formData\.get\("extraLinks"\)/.test(action);
  assert.ok(named, `${FIELD} no longer posts an input named "extraLinks"`);
  assert.ok(readBack, `${ACTION} no longer reads formData "extraLinks" — saving would store nothing and still succeed`);
});

test("the save action stores it on the override, not on Development", () => {
  // feedSync.ts rewrites the Development row on every run; an admin's links on
  // that table would be wiped the next night, exactly as `stage` was
  // (Celestia, 2026-07-17/18). Nothing ever syncs into the override table.
  assert.ok(
    /extraLinks: extraLinksFromJson\(/.test(read(ACTION)),
    "saveOverride no longer passes extraLinks through extraLinksFromJson",
  );
  assert.ok(
    /extraLinks\s+Json\?/.test(read(SCHEMA).slice(read(SCHEMA).indexOf("model DevelopmentOverride"))),
    "extraLinks is not a column on DevelopmentOverride",
  );
});

test("the view model parses the column rather than passing it through raw", () => {
  // It is a Json column: handing it straight to the renderer would put whatever
  // it holds into an href.
  assert.ok(
    /extraLinks: parseExtraLinks\(ov\?\.extraLinks\)/.test(read(RENDER)),
    "developmentRender no longer parses extraLinks — an unvalidated Json value would reach the page",
  );
});

test("the anchor carries nofollow, noopener and noreferrer", () => {
  const body = read(BODY);
  const anchor = body.slice(body.indexOf('className="pp-extra"'));
  const rel = /rel="([^"]+)"/.exec(anchor);
  assert.ok(rel, "the pp-extra anchor has no rel attribute");
  for (const token of ["nofollow", "noopener", "noreferrer"]) {
    assert.ok(rel![1].includes(token), `the pp-extra anchor's rel is missing ${token} (is "${rel![1]}")`);
  }
  assert.ok(/target="_blank"/.test(anchor), "the pp-extra anchor no longer opens in a new tab");
});

test("the buttons render independently of whether a description exists", () => {
  // They live in .pp-about__main but outside the `p.description &&` block: a
  // project can have links before anyone has written copy for it.
  const body = read(BODY);
  const descAt = body.indexOf("{p.description && (");
  const extrasAt = body.indexOf("{extraLinks.length > 0 && (");
  const mainCloses = body.indexOf('</div>\n        </section>', descAt);
  assert.ok(descAt > -1 && extrasAt > -1, "could not locate the description or extras block");
  assert.ok(extrasAt > descAt, "the extras block no longer follows the description");
  assert.ok(
    extrasAt < mainCloses || mainCloses === -1,
    "the extras block moved out of .pp-about__main — the operator asked for it under the description text",
  );
  // The description block's own closing `)}` must come BEFORE the extras, i.e.
  // the extras are not nested inside the conditional.
  const descCloses = body.indexOf("            )}", descAt);
  assert.ok(descCloses > -1 && descCloses < extrasAt, "the extras block sits inside the `p.description &&` conditional");
});

test("the classes the page uses exist in the stylesheet", () => {
  const css = read(CSS);
  for (const cls of [".pp-extras", ".pp-extra", ".pp-sr"]) {
    assert.ok(
      new RegExp(`\\${cls}\\s*[,{:]`).test(css),
      `${cls} is not styled — the buttons would render as bare links, and .pp-sr's new-tab wording would be visible text`,
    );
  }
});
