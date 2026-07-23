// Hard safety gate for any one-off script/command that must NEVER be allowed
// to run against the real production database by accident (e.g. the Lead
// Cockpit migration rehearsal, 2026-07-23). Reads DATABASE_URL, extracts the
// resolved database name, and hard-aborts (exit 1) if it matches the known
// production DB name. Prints the resolved name either way so the operator
// can visually confirm the target before anything runs.
//
// Usage as a gate: node scripts/assert-not-prod-db.mjs && <the real command>
// Usage as a module: import { assertNotProdDb } from "./assert-not-prod-db.mjs"
const PROD_DB_NAME = "cyprusvipestates";

export function resolveDbName(databaseUrl) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  return url.pathname.replace(/^\//, "");
}

export function assertNotProdDb(databaseUrl = process.env.DATABASE_URL) {
  const dbName = resolveDbName(databaseUrl);
  console.log(`Target database (from DATABASE_URL): "${dbName}"`);
  if (dbName === PROD_DB_NAME) {
    console.error(`ABORT: DATABASE_URL resolves to the production database ("${PROD_DB_NAME}"). Refusing to run.`);
    process.exit(1);
  }
  console.log(`OK — not the production database.`);
  return dbName;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertNotProdDb();
}
