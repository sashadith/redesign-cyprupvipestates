// Orchestration of one carousel render (2026-11-05).
//
// The Next.js process never loads Playwright. It resolves the images, builds the
// six slide documents, and runs scripts/social/carousel-worker.mjs as a child
// process:
//   • one render at a time across both pm2 instances (lock file in the OS temp dir);
//   • a hard 60 s limit per carousel — the worker runs in its own process group
//     and is SIGKILLed as a group, then any Chromium still carrying this render's
//     --cve-carousel-run=<id> marker is killed with its own group (Playwright
//     starts the browser detached);
//   • the worker gets a minimal environment: no database URL, no secrets.
// Only when every slide passed every layout rule are the JPGs written — into a
// temp folder that then replaces the old one, so a failed render never leaves a
// broken or half-written set behind.
import { spawn, execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { abs } from "@/lib/seo";
import type { RenderInput } from "./schema";
import { isoWeekFolder, outputSubdir } from "./format";
import { resolveImage, uploadsRoot } from "./imagePolicy";
import { buildCyprusSlides, buildProjectSlides } from "./templates";

export type RenderErrorCode = "layout_rule" | "render_busy" | "render_timeout" | "renderer_not_installed" | "internal";
export class RenderError extends Error {
  constructor(public code: RenderErrorCode, message: string, public detail?: { slide?: number; rule?: number }) {
    super(message);
  }
}

export type SlideReport = {
  slide: number;
  headingPx: number | null;
  templatePx: number | null;
  reduced: boolean;
  /** Rule 2 after the fit, and as the approved layout had it before the fit moved the heading. */
  eyebrowGap: number | null;
  templateEyebrowGap: number | null;
  contentSwipeGap: number | null;
};
export type RenderResult = { folder: string; slides: string[]; preview: string; renderId: string; report: SlideReport[] };
type WorkerSlide = { headingPx: number | null; templatePx: number | null; eyebrowGap: number | null; templateEyebrowGap: number | null; contentSwipeGap: number | null; geometry: unknown };

export const RENDER_TIMEOUT_MS = 60_000;
// Short enough that waiting plus a full render stays near the 60 s proxy timeout of /api/ (nginx).
const LOCK_WAIT_MS = 30_000;
const LOCK_STALE_MS = 120_000;

export type RenderOptions = {
  now?: Date;
  root?: string;
  timeoutMs?: number;
  lockFile?: string;
  workerPath?: string;
  /** QA only: also return each slide's element geometry. */
  withGeometry?: boolean;
};

function imageUrlsOf(input: RenderInput): string[] {
  if (input.template === "project") {
    const d = input.data;
    return [d.heroImage, d.slide2.image, ...d.slide2.tiles.map((t) => t.image), d.slide3.image, d.slide4.image, ...d.slide4.facilities.map((f) => f.facilityImage), d.slide5.image];
  }
  return [input.data.cover.image, ...input.data.slides.map((s) => s.image)];
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cross-process lock: O_EXCL create; a lock whose owner is gone or that is older than 2 min is cleared. */
async function acquireLock(file: string, token: string): Promise<() => Promise<void>> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      await fs.writeFile(file, JSON.stringify({ pid: process.pid, at: Date.now(), token }), { flag: "wx" });
      return async () => {
        const cur = await fs.readFile(file, "utf8").catch(() => "");
        if (cur.includes(`"token":"${token}"`)) await fs.rm(file, { force: true });
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    try {
      const held = JSON.parse(await fs.readFile(file, "utf8")) as { pid: number; at: number };
      if (Date.now() - held.at > LOCK_STALE_MS || !alive(held.pid)) {
        await fs.rm(file, { force: true });
        continue;
      }
    } catch {
      // Unreadable: either being written this instant or garbage. Only clear it once it is old.
      const st = await fs.stat(file).catch(() => null);
      if (st && Date.now() - st.mtimeMs > 5_000) await fs.rm(file, { force: true });
    }
    if (Date.now() > deadline) throw new RenderError("render_busy", "Another carousel is being rendered. Try again in a minute.");
    await sleep(500);
  }
}

const execFileP = (cmd: string, args: string[]) => new Promise<string>((res) => execFile(cmd, args, (_e, out) => res(String(out || ""))));

/** Kill every process still carrying this render's marker, together with its process group. */
export async function sweepChromium(renderId: string): Promise<void> {
  const pids = (await execFileP("pgrep", ["-f", `cve-carousel-run=${renderId}`])).split(/\s+/).filter(Boolean).map(Number);
  for (const pid of pids) {
    for (const target of [-pid, pid]) {
      try {
        process.kill(target, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

function runWorker(workerPath: string, jobFile: string, timeoutMs: number): Promise<{ stdout: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: process.env.NODE_ENV };
    for (const k of ["PLAYWRIGHT_BROWSERS_PATH", "CAROUSEL_TEST_HANG"]) if (process.env[k]) env[k] = process.env[k];
    const child = spawn(process.execPath, [workerPath, jobFile], { detached: true, stdio: ["ignore", "pipe", "pipe"], env });
    let stdout = "";
    let timedOut = false;
    child.stdout.on("data", (b) => (stdout += b));
    child.stderr.on("data", () => {}); // drained, never logged: it can echo page content
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        /* exited meanwhile */
      }
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        process.kill(-child.pid!, "SIGKILL"); // anything the worker left in its group
      } catch {
        /* group already empty */
      }
      resolve({ stdout, timedOut });
    });
  });
}

async function writeSet(finalDir: string, renderId: string, pngs: Buffer[]): Promise<void> {
  const tmpDir = `${finalDir}.tmp-${renderId}`;
  const oldDir = `${finalDir}.old-${renderId}`;
  await fs.mkdir(path.dirname(finalDir), { recursive: true });
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir);
  try {
    const jpgs: Buffer[] = [];
    for (let i = 0; i < pngs.length; i++) {
      const jpg = await sharp(pngs[i]).jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
      jpgs.push(jpg);
      await fs.writeFile(path.join(tmpDir, `${String(i + 1).padStart(2, "0")}.jpg`), jpg);
    }
    // Preview sheet: 3 × 2 at half size.
    const tiles = await Promise.all(jpgs.map((j) => sharp(j).resize(540, 675).toBuffer()));
    await sharp({ create: { width: 1620, height: 1350, channels: 3, background: "#ffffff" } })
      .composite(tiles.map((input, i) => ({ input, left: (i % 3) * 540, top: Math.floor(i / 3) * 675 })))
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(path.join(tmpDir, "preview.jpg"));
    const hadOld = await fs.stat(finalDir).then(() => true, () => false);
    if (hadOld) await fs.rename(finalDir, oldDir);
    await fs.rename(tmpDir, finalDir);
    if (hadOld) await fs.rm(oldDir, { recursive: true, force: true });
  } catch (e) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw e;
  }
}

/** Render, check and store one carousel. Throws ImageRejected (bad image URL) or RenderError. */
export async function renderCarousel(input: RenderInput, opts: RenderOptions = {}): Promise<RenderResult & { geometry?: unknown[] }> {
  const root = opts.root ?? uploadsRoot();
  const resolved = new Map<string, string>();
  for (const url of imageUrlsOf(input)) if (!resolved.has(url)) resolved.set(url, await resolveImage(url, root));
  const img = (u: string) => resolved.get(u)!;
  const slides = input.template === "project" ? await buildProjectSlides(input.data, input.lang, img) : await buildCyprusSlides(input.data, input.lang, img);

  const renderId = `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
  const release = await acquireLock(opts.lockFile ?? path.join(os.tmpdir(), "cve-carousel.lock"), renderId);
  const work = path.join(os.tmpdir(), `cve-carousel-${renderId}`);
  try {
    await fs.mkdir(work, { recursive: true });
    const jobSlides = await Promise.all(
      slides.map(async (s, i) => {
        const file = path.join(work, `slide-${i + 1}.html`);
        await fs.writeFile(file, s.html);
        return { file, headingPx: s.headingPx, swipe: s.swipe, eyebrow: s.eyebrow, photoFit: s.photoFit };
      }),
    );
    const jobFile = path.join(work, "job.json");
    await fs.writeFile(jobFile, JSON.stringify({ renderId, dir: work, slides: jobSlides }));
    const workerPath = opts.workerPath ?? process.env.CAROUSEL_WORKER ?? path.join(process.cwd(), "scripts", "social", "carousel-worker.mjs");
    const { stdout, timedOut } = await runWorker(workerPath, jobFile, opts.timeoutMs ?? RENDER_TIMEOUT_MS);
    if (timedOut) throw new RenderError("render_timeout", `Rendering took longer than ${Math.round((opts.timeoutMs ?? RENDER_TIMEOUT_MS) / 1000)} s and was stopped. Nothing was saved.`);
    let res: { ok: boolean; error?: string; slide?: number; rule?: number; detail?: string; slides?: WorkerSlide[] };
    try {
      res = JSON.parse(stdout.trim().split("\n").pop() || "");
    } catch {
      throw new RenderError("internal", "The renderer stopped without a result. Nothing was saved.");
    }
    if (!res.ok) {
      if (res.error === "layout_rule") throw new RenderError("layout_rule", `Slide ${res.slide}, rule ${res.rule}: ${res.detail}. Nothing was saved.`, { slide: res.slide, rule: res.rule });
      if (res.error === "renderer_not_installed") throw new RenderError("renderer_not_installed", "Chromium for the carousel renderer is not installed on this server (see DEPLOYMENT.md).");
      throw new RenderError("internal", "The renderer failed. Nothing was saved.");
    }
    const pngs = await Promise.all(slides.map((_, i) => fs.readFile(path.join(work, `slide-${i + 1}.png`))));
    const sub = outputSubdir(isoWeekFolder(input.postingDate, opts.now ?? new Date()), input.slug, input.lang);
    await writeSet(path.join(root, sub), renderId, pngs);
    const url = (f: string) => `${abs(`/uploads/${sub}/${f}`)}?v=${renderId}`;
    const ws = res.slides!;
    return {
      folder: `/uploads/${sub}/`,
      slides: ws.map((_, i) => url(`${String(i + 1).padStart(2, "0")}.jpg`)),
      preview: url("preview.jpg"),
      renderId,
      report: ws.map((s, i) => ({ slide: i + 1, headingPx: s.headingPx, templatePx: s.templatePx, reduced: !!s.templatePx && s.headingPx !== s.templatePx, eyebrowGap: s.eyebrowGap, templateEyebrowGap: s.templateEyebrowGap, contentSwipeGap: s.contentSwipeGap })),
      ...(opts.withGeometry ? { geometry: ws.map((s) => s.geometry) } : {}),
    };
  } finally {
    await sweepChromium(renderId);
    await fs.rm(work, { recursive: true, force: true });
    await release();
  }
}
