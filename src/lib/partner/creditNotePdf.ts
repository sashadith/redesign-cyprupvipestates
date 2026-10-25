import { spawn } from "node:child_process";
import { join } from "node:path";
import type { CreditNoteModel } from "./creditNote";

// Server: renders a credit-note PDF in a short-lived child process
// (scripts/credit-note-pdf-worker.mjs; same pattern as the pdf-*-worker scripts).
// The worker repeats a minimal copy of isCreditNoteModel — keep the two in step.

export const CREDIT_NOTE_RENDER_TIMEOUT_MS = 20_000;
export const CREDIT_NOTE_MAX_PDF_BYTES = 5 * 1024 * 1024;
export const CREDIT_NOTE_MAX_INPUT_BYTES = 64 * 1024;

const STRING_FIELDS = [
  "title", "numberLabel", "number", "dateLabel", "date", "issuerLabel", "recipientLabel",
  "referenceLabel", "reference", "paymentNote", "selfBillingNote",
] as const;

const strArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Pure shape check of the JSON the worker receives (all expected string fields present). */
export function isCreditNoteModel(v: unknown): v is CreditNoteModel {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const m = v as Record<string, unknown>;
  if (!STRING_FIELDS.every((k) => typeof m[k] === "string")) return false;
  if (!strArray(m.issuerLines) || !strArray(m.recipientLines)) return false;
  if (!Array.isArray(m.rows) || m.rows.length === 0) return false;
  for (const r of m.rows as unknown[]) {
    if (!r || typeof r !== "object") return false;
    const row = r as Record<string, unknown>;
    if (typeof row.label !== "string" || typeof row.amount !== "string") return false;
  }
  if (m.vatNote !== null && typeof m.vatNote !== "string") return false;
  if (m.draftFooter !== null && typeof m.draftFooter !== "string") return false;
  return true;
}

export function isPdfBytes(b: Buffer): boolean {
  return b.length > 5 && b.subarray(0, 5).toString("latin1") === "%PDF-";
}

export function creditNoteWorkerPath(cwd: string = process.cwd()): string {
  return join(cwd, "scripts", "credit-note-pdf-worker.mjs");
}

export function renderCreditNotePdf(model: CreditNoteModel, opts: { timeoutMs?: number; cwd?: string } = {}): Promise<Buffer> {
  if (!isCreditNoteModel(model)) return Promise.reject(new Error("Credit note model is incomplete."));
  const input = Buffer.from(JSON.stringify(model), "utf8");
  if (input.length > CREDIT_NOTE_MAX_INPUT_BYTES) return Promise.reject(new Error("Credit note model is too large."));
  const cwd = opts.cwd ?? process.cwd();
  return new Promise<Buffer>((resolve, reject) => {
    const p = spawn(process.execPath, [creditNoteWorkerPath(cwd)], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let err = "";
    let settled = false;
    const finish = (e: Error | null, b?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (e) reject(e);
      else resolve(b as Buffer);
    };
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      finish(new Error("Credit note PDF rendering timed out."));
    }, opts.timeoutMs ?? CREDIT_NOTE_RENDER_TIMEOUT_MS);
    p.stdout.on("data", (d: Buffer) => {
      size += d.length;
      if (size > CREDIT_NOTE_MAX_PDF_BYTES) {
        p.kill("SIGKILL");
        finish(new Error("Credit note PDF is too large."));
        return;
      }
      chunks.push(d);
    });
    p.stderr.on("data", (d: Buffer) => {
      if (err.length < 2000) err += d.toString("utf8");
    });
    p.on("error", (e) => finish(e));
    p.stdin.on("error", () => {}); // a dying worker closes stdin; the exit code reports it
    p.on("close", (code) => {
      if (code !== 0) return finish(new Error(`Credit note PDF rendering failed (exit ${code}): ${err.slice(0, 500)}`));
      const pdf = Buffer.concat(chunks);
      if (!isPdfBytes(pdf)) return finish(new Error("Credit note renderer returned no PDF."));
      finish(null, pdf);
    });
    p.stdin.end(input);
  });
}
