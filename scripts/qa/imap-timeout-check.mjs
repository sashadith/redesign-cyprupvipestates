#!/usr/bin/env node
/* Self-test for the IMAP poll's timeout budget (src/lib/emailInbound/imapClient.ts).

   Runs against a fake IMAP server on localhost — no credentials, no network,
   nothing touched in the real mailbox.

   Why it exists: on 2026-09-08 the mail server accepted the connection and
   then stopped answering. Two poll runs sat there 180 s each (13:22→13:25 and
   13:27→13:30 UTC) and only ended because the SERVER closed the socket —
   ImapFlow's own default would have waited 5 minutes, which is the poll
   interval itself, so runs would have started overlapping. Measured here
   before the fix: 300 014 ms. After: ~60 s.

     node scripts/qa/imap-timeout-check.mjs           # fast cases (~11 s)
     node scripts/qa/imap-timeout-check.mjs --slow    # plus the 60 s socket bound

   Exits non-zero on any failed assertion. */
import net from "node:net";
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const SLOW = process.argv.includes("--slow");
const scratch = join(process.cwd(), "node_modules", ".imap-timeout-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

const stray = [];
process.on("unhandledRejection", (e) => stray.push(e?.message ?? String(e)));

const out = await build({
  entryPoints: ["src/lib/emailInbound/imapClient.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", "imapflow", ".prisma/client/default"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const f = join(scratch, "c.mjs");
writeFileSync(f, out.outputFiles[0].text);
const { withReadOnlyInbox, withTimeout } = await import(f);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n       erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`}`);
};

/** A fake IMAP server, enough of one to complete a real handshake.
    Modes: "silent" never greets · "drop" greets then kills the socket ·
    "hang" greets then never answers · "happy" serves a full read-only session ·
    "hangOnLogout" serves the session but never answers LOGOUT ·
    "readWrite" answers EXAMINE as READ-WRITE, which must be refused. */
function fakeServer(mode) {
  const seen = [];
  return new Promise((res) => {
    const srv = net.createServer((sock) => {
      sock.on("error", () => {});
      if (mode === "silent") return;
      sock.write("* OK fake IMAP4rev1 ready\r\n");
      if (mode === "hang") return;
      if (mode === "drop") { setTimeout(() => sock.destroy(), 150); return; }
      let buf = "";
      sock.on("data", (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf("\r\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 2);
          const sp = line.indexOf(" ");
          const tag = line.slice(0, sp);
          const cmd = line.slice(sp + 1).split(" ")[0].toUpperCase();
          seen.push(cmd);
          if (cmd === "LOGOUT" && mode === "hangOnLogout") return; // never answered
          if (cmd === "CAPABILITY") {
            sock.write("* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n");
            sock.write(tag + " OK done\r\n");
          } else if (cmd === "EXAMINE" || cmd === "SELECT") {
            sock.write("* 0 EXISTS\r\n* 0 RECENT\r\n* FLAGS (\\Seen)\r\n* OK [UIDVALIDITY 12] ok\r\n* OK [UIDNEXT 1] ok\r\n");
            sock.write(tag + " OK [" + (mode === "readWrite" ? "READ-WRITE" : "READ-ONLY") + "] done\r\n");
          } else if (cmd === "LOGOUT") {
            sock.write("* BYE bye\r\n");
            sock.write(tag + " OK done\r\n");
          } else {
            sock.write(tag + " OK done\r\n");
          }
        }
      });
    });
    srv.listen(0, "127.0.0.1", () => res({ srv, port: srv.address().port, seen }));
  });
}

async function timePoll(mode) {
  const { srv, port, seen } = await fakeServer(mode);
  const t0 = Date.now();
  let message = null, value = null;
  try {
    // port !== 993 → plain TCP, so the fake server needs no certificate.
    value = await withReadOnlyInbox({ host: "127.0.0.1", port, user: "u", pass: "p" },
      async (_c, mailbox) => `uidValidity=${mailbox.uidValidity}`);
  } catch (e) { message = e.message; }
  srv.close();
  return { ms: Date.now() - t0, message, value, seen };
}

console.log("\nwithTimeout bounds a promise and cleans up after itself");
{
  const slow = new Promise(() => {});
  const t0 = Date.now();
  const guard = new Promise((res) => setTimeout(() => res("NEVER SETTLED"), 5_000));
  const msg = await Promise.race([
    withTimeout(slow, 120, "test op").then(() => "RESOLVED, should not have", (e) => e.message),
    guard,
  ]);
  const ms = Date.now() - t0;
  check("rejects when the promise never settles", msg, "test op timed out after 120 ms");
  check("and does so at roughly the deadline", ms >= 110 && ms < 2000, true);
  check("passes a fast value straight through", await withTimeout(Promise.resolve(7), 5000, "x"), 7);
  const t1 = Date.now();
  await withTimeout(Promise.resolve(1), 30_000, "x");
  check("a long deadline does not delay a resolved promise", Date.now() - t1 < 1000, true);
}

console.log("\na server that never greets fails fast, not at ImapFlow's 16 s default");
{
  const r = await timePoll("silent");
  check("gives up under 14 s", r.ms < 14_000, true);
  check("and not instantly either", r.ms > 5_000, true);
  check("reports a greeting failure", /greeting/i.test(r.message ?? ""), true);
}

console.log("\na healthy mailbox still opens read-only and returns its status");
{
  const r = await timePoll("happy");
  check("succeeds", r.value, "uidValidity=12");
  check("in well under a second", r.ms < 1_000, true);
  check("via EXAMINE, never SELECT", r.seen.includes("EXAMINE") && !r.seen.includes("SELECT"), true);
  check("and logs out cleanly", r.seen.includes("LOGOUT"), true);
}

/* The guard that makes this module safe to point at a real inbox: if the
   mailbox ever opens writable, abort before touching a message. */
console.log("\na mailbox that opens writable is refused outright");
{
  const r = await timePoll("readWrite");
  check("no value returned", r.value, null);
  check("and it says why", /read-only/i.test(r.message ?? ""), true);
}

/* Cleanup must never extend a run. Without a bound this waits for the socket
   timeout instead: 60 s measured, against 5 s with it. */
console.log("\na server that never answers LOGOUT cannot stretch the run");
{
  const r = await timePoll("hangOnLogout");
  check("bounded under 20 s", r.ms < 20_000, true);
  check("and the caller still gets its result", r.value, "uidValidity=12");
}

console.log("\na server that drops the connection is reported immediately");
{
  const r = await timePoll("drop");
  check("settles in under 5 s", r.ms < 5_000, true);
  check("surfaces the close", /close|connection/i.test(r.message ?? ""), true);
}

if (SLOW) {
  console.log("\na server that greets and then goes silent is cut off well inside the 5-minute poll interval");
  const r = await timePoll("hang");
  check("bounded under 90 s (ImapFlow's default would be 300 s)", r.ms < 90_000, true);
  check("and clearly longer than the greeting bound, so it is the socket bound", r.ms > 30_000, true);
  check("reports a socket timeout", /timeout/i.test(r.message ?? ""), true);
} else {
  console.log("\n  (skipped: the 60 s socket-bound case — re-run with --slow)");
}

// A dying connection used to reject inside the cleanup with "Already logged
// out", with nothing awaiting it. Node treats an unhandled rejection as fatal
// by default, so this is a crash risk, not noise.
await new Promise((r) => setTimeout(r, 750)); // let late rejections land first
console.log("\nnothing escapes as an unhandled rejection");
check("no stray rejections across every case above", stray, []);

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
