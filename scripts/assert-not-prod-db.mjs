// Hard safety gate for any one-off script/command that must NEVER be allowed
// to run against the real production database by accident (e.g. the Lead
// Cockpit migration rehearsal, 2026-07-23). Reads DATABASE_URL, extracts the
// resolved database name, and hard-aborts (exit 1) if it matches the known
// production DB name. Prints the resolved name either way so the operator
// can visually confirm the target before anything runs.
//
// Extended 2026-08-12 (isolated-script DB safety incident — see DEPLOYMENT.md's
// "Isolated-script DB safety" section): a verification script sourced BOTH
// .env.testbed and /var/www/shared/.env to get testbed DB + shared API keys in
// one shot, and shared/.env's own DATABASE_URL — sourced second — silently
// overwrote the testbed one, so the script ran a real Drive sync against the
// live prod DB. Harmless that time, but the isolation property held by luck,
// not enforcement. This is now the guard `/opt/cvp-testbed/with-shared-secret.sh`
// runs automatically before any command it launches, and the check also
// widened from matching the prod DB *name* alone to also matching the prod
// *role* — a URL can carry a non-default dbname while still authenticating as
// the real prod role, which the name-only check wouldn't catch.
//
// Usage as a gate: node scripts/assert-not-prod-db.mjs && <the real command>
// Usage as a module: import { assertNotProdDb } from "./assert-not-prod-db.mjs"
//
// Set CVP_ALLOW_PROD_DB=1 to bypass, for the rare legitimate case of a
// deliberate, disclosed, READ-ONLY query against prod. Never set it for
// anything that writes.
const PROD_DB_NAME = "cyprusvipestates";
const PROD_ROLE = "cyprusvip";

export function resolveDbName(databaseUrl) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  return url.pathname.replace(/^\//, "");
}

export function assertNotProdDb(databaseUrl = process.env.DATABASE_URL) {
  const dbName = resolveDbName(databaseUrl);
  const role = new URL(databaseUrl).username;
  console.log(`Target database (from DATABASE_URL): "${dbName}" (role "${role}")`);

  const isProd = dbName === PROD_DB_NAME || role === PROD_ROLE;
  if (isProd && process.env.CVP_ALLOW_PROD_DB === "1") {
    console.warn(`⚠️  CVP_ALLOW_PROD_DB=1 set — proceeding against production ("${dbName}") for a deliberate, disclosed, READ-ONLY query. This must never be set for anything that writes.`);
    return dbName;
  }
  if (isProd) {
    console.error(
      [
        "",
        `ABORT: DATABASE_URL resolves to the production database ("${dbName}", role "${role}"). Refusing to run.`,
        "",
        "  If multiple .env files were sourced, a later one likely overwrote",
        "  DATABASE_URL — check load order, don't just re-run. For a testbed run",
        "  that also needs shared secrets (GOOGLE_*, ANTHROPIC_API_KEY), use",
        "  /opt/cvp-testbed/with-shared-secret.sh instead of sourcing shared/.env",
        "  directly — see DEPLOYMENT.md's 'Isolated-script DB safety' section.",
        "",
        "  For a deliberate, disclosed, READ-ONLY query against prod, set",
        "  CVP_ALLOW_PROD_DB=1 explicitly. Never for anything that writes.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
  console.log(`OK — not the production database.`);
  return dbName;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertNotProdDb();
}
