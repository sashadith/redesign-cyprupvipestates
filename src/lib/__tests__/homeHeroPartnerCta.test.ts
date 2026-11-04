import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeStrings } from "@/app/preview-home/sections/homeI18n";

test("hero 'Become a Partner': labelled in en/de/pl/ru, absent in he (no Hebrew partners page)", () => {
  assert.equal(homeStrings("en").becomePartner, "Become a Partner");
  assert.equal(homeStrings("de").becomePartner, "Partner werden");
  assert.equal(homeStrings("pl").becomePartner, "Zostań partnerem");
  assert.equal(homeStrings("ru").becomePartner, "Стать партнёром");
  assert.equal(homeStrings("he").becomePartner, undefined);
});

test("hero wiring: third glass button after the consultation CTA, locale partners page, wraps on tablets", () => {
  const hero = readFileSync("src/app/preview-home/sections/Hero.tsx", "utf8");
  assert.ok(hero.includes('const partnersHref = lang === "en" ? "/partners" : `/${lang}/partners`;'));
  const consult = hero.indexOf("{t.getConsultation}");
  const partner = hero.indexOf('<a className="btn btn--glass" href={partnersHref}>');
  assert.ok(consult > 0 && partner > consult, "after Get Consultation, same glass style");
  assert.ok(readFileSync("src/app/preview-home/tokens.css", "utf8").includes(".hero__cta { margin-top: var(--s-7); display: flex; flex-wrap: wrap;"));
});
