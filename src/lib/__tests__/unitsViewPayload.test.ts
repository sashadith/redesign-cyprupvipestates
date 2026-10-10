import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import UnitsView, { type UnitVM } from "@/app/preview-project/UnitsView";

/* The app builds with Next's automatic JSX runtime (tsconfig "jsx": "preserve"),
   so component files legitimately use JSX without importing React — Bdi.tsx is
   one. Under the test runner, tsx/esbuild falls back to the CLASSIC transform
   and emits React.createElement, which those files have no local binding for.
   Exposing React globally restores exactly the production semantics for the
   duration of the test; it changes nothing about how the app is built. */
(globalThis as unknown as { React: typeof React }).React = React;

/* Unit payload trim (2026-10-09). UnitsView renders AVAILABLE units only —
   sold and reserved contribute a number to the line under the heading and
   nothing else, and unlisted is dropped entirely. It is also the project
   page's only client component that takes units, so whatever it is handed
   crosses into the RSC payload. Handing it the full list shipped every sold
   unit's photos, plans, attrs and description to a browser that never drew
   them (measured: 1,027 unit-photo URLs across 127 published, still-selling
   projects).

   ProjectPageBody now passes the renderable units plus `unavailableCount`.
   These tests pin the thing that makes that safe: the OUTPUT MUST NOT CHANGE.
   The internal filtering stays, so the full list still renders identically. */

const unit = (ref: string, status: UnitVM["status"], price: number): UnitVM => ({
  ref, name: `Unit ${ref}`, label: `Nr. ${ref}`, type: "apartment",
  status, statusLabel: status, price, currency: "EUR",
  beds: "2", baths: "1", areaBuilt: "90", areaPlot: "", areaVeranda: "12", floor: "1",
  attrs: [{ name: "Location", value: "Emba" }], features: ["Pool"],
  photos: [`/uploads/developments/d/${ref}aaaaaaaaaaaa_medium.webp`, `/uploads/developments/d/${ref}bbbbbbbbbbbb_medium.webp`],
  plans: [`/uploads/developments/d/${ref}cccccccccccc_medium.webp`],
  coords: null, description: `Description for ${ref}`,
});

const AVAILABLE = [unit("a1", "available", 300000), unit("a2", "available", 250000)];
const HIDDEN = [unit("s1", "sold", 200000), unit("s2", "sold", 210000), unit("r1", "reserved", 220000)];
const UNLISTED = [unit("u1", "unlisted", 190000)];
const ALL = [...AVAILABLE, ...HIDDEN, ...UNLISTED];

const render = (units: UnitVM[], unavailableCount?: number) =>
  renderToStaticMarkup(React.createElement(UnitsView, { units, projectName: "Test Project", lang: "en", unavailableCount }));

test("passing only the renderable units produces byte-identical markup", () => {
  const before = render(ALL);                 // what ProjectPageBody used to pass
  const after = render(AVAILABLE, HIDDEN.length); // what it passes now
  assert.equal(after, before, "trimming the payload must not change a single byte of output");
});

test("the trimmed payload still carries no sold, reserved or unlisted unit", () => {
  const markup = render(AVAILABLE, HIDDEN.length);
  for (const u of [...HIDDEN, ...UNLISTED]) {
    assert.ok(!markup.includes(u.ref + "aaaa"), `${u.status} unit ${u.ref} photo must not appear`);
    assert.ok(!markup.includes(u.description), `${u.status} unit ${u.ref} description must not appear`);
  }
  // ...while every available unit still renders its thumbnail and label.
  for (const u of AVAILABLE) {
    assert.ok(markup.includes(u.ref + "aaaa"), `available unit ${u.ref} must still render its photo`);
    assert.ok(markup.includes(u.label), `available unit ${u.ref} must still render its label`);
  }
});

test("the availability line keeps counting the units that are no longer passed", () => {
  const markup = render(AVAILABLE, HIDDEN.length);
  const text = markup.replace(/<[^>]+>/g, " ");
  assert.match(text, /\b2\b/, "two available");
  assert.match(text, /\b3\b/, "three sold/reserved, counted though not passed");
  // Unlisted is never counted — it is not 'sold' for a buyer to see.
  assert.equal(render(ALL).replace(/<[^>]+>/g, " "), text, "same line as the untrimmed render");
});

test("without the prop the count is still derived, so the component stands alone", () => {
  assert.equal(render(ALL), render(ALL, undefined), "an absent count falls back to the internal split");
});
