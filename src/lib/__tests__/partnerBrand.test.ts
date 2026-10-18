import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBrand, sniffImageType, BRAND_LOGO_MAX_BYTES, BRAND_ERROR_CODES } from "@/lib/partner/brand";
import { PARTNER_LOCALES, lookup } from "@/lib/partner/i18n";

test("validateBrand: all optional; empty strings become null", () => {
  assert.deepEqual(validateBrand({}), { ok: true, data: { brandName: null, brandPhone: null, brandEmail: null, brandWebsite: null } });
  assert.deepEqual(validateBrand({ brandName: " ", brandPhone: "", brandEmail: null, brandWebsite: "" }), {
    ok: true, data: { brandName: null, brandPhone: null, brandEmail: null, brandWebsite: null },
  });
});

test("validateBrand: normalises valid values", () => {
  const r = validateBrand({ brandName: "  Acme Realty ", brandPhone: "+49 (170) 123-4567", brandEmail: " Info@Acme.DE ", brandWebsite: "https://acme.de/team" });
  assert.deepEqual(r, { ok: true, data: { brandName: "Acme Realty", brandPhone: "+491701234567", brandEmail: "info@acme.de", brandWebsite: "https://acme.de/team" } });
});

test("validateBrand: rejects bad input with dotted keys", () => {
  assert.deepEqual(validateBrand(null), { ok: false, field: "_", code: "err.invalid" });
  assert.deepEqual(validateBrand([]), { ok: false, field: "_", code: "err.invalid" });
  assert.deepEqual(validateBrand({ x: 1 }), { ok: false, field: "x", code: "err.unknownField" });
  assert.deepEqual(validateBrand({ brandName: "a".repeat(81) }), { ok: false, field: "brandName", code: "err.brandName" });
  assert.deepEqual(validateBrand({ brandName: "a\u0007b" }), { ok: false, field: "brandName", code: "err.brandName" });
  assert.deepEqual(validateBrand({ brandName: 5 }), { ok: false, field: "brandName", code: "err.brandName" });
  assert.deepEqual(validateBrand({ brandPhone: "12ab" }), { ok: false, field: "brandPhone", code: "err.phone" });
  assert.deepEqual(validateBrand({ brandPhone: "123" }), { ok: false, field: "brandPhone", code: "err.phone" });
  assert.deepEqual(validateBrand({ brandEmail: "nope" }), { ok: false, field: "brandEmail", code: "err.email" });
  for (const w of ["http://acme.de", "javascript:alert(1)", "https://", "acme.de", "https://acme.de/" + "a".repeat(200), "https://ac me.de", 'https://a.de/"><x', "https://user:pw@acme.de"]) {
    assert.deepEqual(validateBrand({ brandWebsite: w }), { ok: false, field: "brandWebsite", code: "err.website" }, w);
  }
});

test("brand error codes resolve in every locale", () => {
  for (const l of PARTNER_LOCALES) for (const k of BRAND_ERROR_CODES) assert.ok(lookup(l, k), `${l} ${k}`);
});

test("sniffImageType: magic bytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
  const gif = new TextEncoder().encode("GIF89a.......");
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const riffWav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);
  assert.equal(sniffImageType(png), "image/png");
  assert.equal(sniffImageType(jpg), "image/jpeg");
  assert.equal(sniffImageType(webp), "image/webp");
  assert.equal(sniffImageType(gif), null);
  assert.equal(sniffImageType(svg), null);
  assert.equal(sniffImageType(riffWav), null);
  assert.equal(sniffImageType(new Uint8Array([0x89, 0x50])), null);
  assert.equal(sniffImageType(new Uint8Array()), null);
});

test("logo size limit is 300 KB", () => {
  assert.equal(BRAND_LOGO_MAX_BYTES, 307_200);
});
