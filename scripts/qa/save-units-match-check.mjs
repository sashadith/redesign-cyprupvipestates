#!/usr/bin/env node
/* Guard: the admin unit editor's save (saveUnits in
   src/app/admin/(panel)/developments/[id]/actions.ts) keeps each unit's
   sync-owned fields — feedRef, source, attrs, plans, photos — on THAT unit.

   2026-09-26: saveUnits matched stored rows by LABEL. Plus 70-71 has "101",
   "102" … in both buildings; one save (setting unit types) gave all ten Plus
   70 units Plus 71's feedRef, and the next nightly sync would have duplicated
   them on a published page. It now matches by database id first, and by label
   only when the label is unique in the project.

   Runs saveUnits against an in-memory stand-in for Prisma — no database.
     node scripts/qa/save-units-match-check.mjs */
import { writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "qa-save-units-")));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const w = (name, src) => { const p = join(tmp, name); writeFileSync(p, src); return p; };

// CommonJS stubs: named imports resolve by property access at run time, so one
// generic stub can stand in for every module saveUnits never calls.
const prismaStub = w("prisma.cjs", `
const store = globalThis.__units = globalThis.__units || [];
const pick = (o, sel) => sel ? Object.fromEntries(Object.keys(sel).map((k) => [k, o[k]])) : { ...o };
module.exports.prisma = {
  developmentUnit: {
    findMany: async ({ where, select }) => store.filter((u) => u.developmentId === where.developmentId).map((u) => pick(u, select)),
    deleteMany: async ({ where }) => { const keep = store.filter((u) => u.developmentId !== where.developmentId); store.length = 0; store.push(...keep); },
    createMany: async ({ data }) => { data.forEach((d, i) => store.push({ id: "new-" + i, ...d })); },
  },
  development: { findUnique: async () => ({ feedKey: "plusproperties:70-71" }) },
};`);
const mirrorStub = w("mirror.cjs", `
module.exports.mirrorAny = async (urls) => ({ urls, anyNew: false });
module.exports.devKeyFor = () => "dev";
module.exports.scheduleAppRestart = () => {};`);
// Everything saveUnits calls besides Prisma and the mirror; every other import
// of the actions file is never reached by it and resolves to an empty module.
const anyStub = w("any.cjs", `
module.exports.recomputeDevelopmentDerivedState = async () => {};
module.exports.revalidatePath = () => {};`);

const out = await build({
  entryPoints: ["src/app/admin/(panel)/developments/[id]/actions.ts"], bundle: true, platform: "node", format: "esm", write: false,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /^@\/lib\/prisma$/ }, () => ({ path: prismaStub }));
    b.onResolve({ filter: /^@\/lib\/imageMirror$/ }, () => ({ path: mirrorStub }));
    b.onResolve({ filter: /^(@\/lib\/|next\/|@prisma\/client$)/ }, () => ({ path: anyStub }));
  } }],
});
const bundle = join(tmp, "actions.mjs");
writeFileSync(bundle, out.outputFiles[0].text);
const { saveUnits } = await import(bundle);

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

const DEV = "dev7071";
const stored = (id, ref, label, extra = {}) => ({ id, developmentId: DEV, ref, label, feedRef: ref, source: "feed", attrs: [{ name: "Parking", value: ref }], plans: ["/plan-" + ref + ".webp"], photos: [], type: null, ...extra });
const seed = (rows) => { globalThis.__units.length = 0; globalThis.__units.push(...rows); };
// What the editor sends back: every stored row with its id, fields edited.
const form = (rows, edit = {}) => rows.map((r) => ({ id: r.id, label: r.label, ref: r.ref, type: edit.type ?? r.type ?? "", status: "available", price: "", photos: r.photos }));
const byRef = () => Object.fromEntries(globalThis.__units.map((u) => [u.ref, u]));

/* ── the incident: the same label in two buildings ── */
const rows = [stored("a", "PLUS 70 101", "101"), stored("b", "PLUS 71 101", "101"), stored("c", "PLUS 70 102", "102"), stored("d", "PLUS 71 102", "102")];
seed(rows);
await saveUnits(DEV, form(rows, { type: "Apartment" }));
let u = byRef();
check("each unit keeps its own feedRef when labels repeat", ["PLUS 70 101", "PLUS 71 101", "PLUS 70 102", "PLUS 71 102"].map((r) => u[r].feedRef), ["PLUS 70 101", "PLUS 71 101", "PLUS 70 102", "PLUS 71 102"]);
check("…and its own attrs", u["PLUS 70 101"].attrs[0].value, "PLUS 70 101");
check("…and its own floor plans (were dropped before)", u["PLUS 71 102"].plans, ["/plan-PLUS 71 102.webp"]);
check("…source stays feed", Array.from(new Set(globalThis.__units.map((x) => x.source))), ["feed"]);
check("the edited type is saved", Array.from(new Set(globalThis.__units.map((x) => x.type))), ["Apartment"]);

/* ── a caller without ids still works when labels are unique ── */
const uniq = [stored("e", "A01", "A01"), stored("f", "A02", "A02")];
seed(uniq);
await saveUnits(DEV, uniq.map((r) => ({ label: r.label, ref: r.ref, status: "available" })));
u = byRef();
check("no id, unique label: feedRef still carried", [u["A01"].feedRef, u["A02"].feedRef], ["A01", "A02"]);

/* ── no id and an ambiguous label: carry nothing rather than the wrong unit ── */
seed([stored("g", "PLUS 70 101", "101"), stored("h", "PLUS 71 101", "101")]);
await saveUnits(DEV, [{ label: "101", ref: "PLUS 70 101", status: "available" }]);
u = byRef();
check("no id, repeated label: nothing is borrowed from the other building", [u["PLUS 70 101"].feedRef, u["PLUS 70 101"].source], [null, "manual"]);

/* ── a brand-new unit stays manual ── */
seed([stored("i", "A01", "A01")]);
await saveUnits(DEV, [{ id: "i", label: "A01", ref: "A01", status: "available" }, { label: "X9", ref: "X9", status: "available" }]);
u = byRef();
check("a new row is manual, the old one stays feed", [u["X9"].source, u["A01"].source], ["manual", "feed"]);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
