import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestOwner, type Candidate } from "@/lib/crm/suggestOwner";

const c = (o: Partial<Candidate> & { id: string }): Candidate => ({
  name: o.id, acceptsLeads: true, isActive: true, languages: [], specialties: [], activeLeads: 0, ...o,
});

test("language match wins, then fewest active leads", () => {
  const s = suggestOwner({ language: "ru", specialtyKeys: [] }, [
    c({ id: "anna", languages: ["de"], activeLeads: 1 }),
    c({ id: "dmitri", languages: ["ru", "en"], activeLeads: 9 }),
    c({ id: "olga", languages: ["ru"], activeLeads: 12 }),
  ]);
  assert.equal(s?.userId, "dmitri");
  assert.equal(s?.reason, "speaks RU · 9 active");
  assert.equal(s?.languageMatch, true);
});

test("a specialty match breaks a tie between speakers of the language", () => {
  const s = suggestOwner({ language: "de", specialtyKeys: ["paphos"] }, [
    c({ id: "a", languages: ["de"], activeLeads: 3 }),
    c({ id: "b", languages: ["de"], specialties: ["Paphos"], activeLeads: 8 }),
  ]);
  assert.equal(s?.userId, "b");
  assert.equal(s?.reason, "speaks DE · Paphos · 8 active");
});

test("no language match falls back to the least loaded and says so", () => {
  const s = suggestOwner({ language: "pl", specialtyKeys: [] }, [
    c({ id: "a", languages: ["de"], activeLeads: 5 }),
    c({ id: "b", languages: ["ru"], activeLeads: 2 }),
  ]);
  assert.equal(s?.userId, "b");
  assert.equal(s?.languageMatch, false);
  assert.equal(s?.reason, "no PL speaker · 2 active");
});

test("people on holiday or deactivated are never suggested", () => {
  const s = suggestOwner({ language: "de", specialtyKeys: [] }, [
    c({ id: "away", languages: ["de"], acceptsLeads: false }),
    c({ id: "gone", languages: ["de"], isActive: false }),
    c({ id: "here", languages: ["en"], activeLeads: 4 }),
  ]);
  assert.equal(s?.userId, "here");
});

test("nobody available means no suggestion", () => {
  assert.equal(suggestOwner({ language: null, specialtyKeys: [] }, [c({ id: "x", acceptsLeads: false })]), null);
});

test("a lead without a language is matched on load only", () => {
  const s = suggestOwner({ language: null, specialtyKeys: [] }, [c({ id: "a", activeLeads: 3 }), c({ id: "b", activeLeads: 1 })]);
  assert.equal(s?.userId, "b");
  assert.equal(s?.reason, "1 active");
});
