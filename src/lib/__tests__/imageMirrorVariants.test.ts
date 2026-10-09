import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import { mkdtemp, readFile, writeFile, stat, readdir, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";

/* Zero-byte mirrored variants (2026-10-09). Five variants across two Island
   Blue units served as blank images on the live site from 2026-07-05 until
   they were found three months later. Four images in island-blue-21 and two
   in island-blue-65 were cut off mid-write at one instant each, and three of
   them never got a _large file at all — an abruptly killed process, not a
   per-image sharp or disk error.
   
   Two properties kept the damage alive, and both are asserted here:
     - writeFile() truncates in place, so an interrupted write leaves an EMPTY
       file where a good one was. Writes now go to a temp file and rename().
     - "already mirrored" asked only whether <hash>_medium.webp EXISTED, so a
       0-byte medium answered yes and no later sync could ever heal it.
   See src/lib/imageMirror.ts. */

// mirrorImage() resolves its storage root from process.cwd(), so each case runs
// in its own scratch directory and never sees the real store.
async function withMirror<T>(fn: (ctx: {
  mirror: typeof import("@/lib/imageMirror").mirrorImage;
  dir: string; src: string; served: () => number;
}) => Promise<T>): Promise<T> {
  const cwd = process.cwd();
  const work = await mkdtemp(join(tmpdir(), "mirror-variants-"));
  process.chdir(work);
  // 2000px wide, so all three variants are genuinely different sizes.
  const png = await sharp({ create: { width: 2000, height: 1400, channels: 3, background: { r: 10, g: 120, b: 200 } } }).png().toBuffer();
  let hits = 0;
  const srv: Server = createServer((_q, res) => { hits++; res.writeHead(200, { "content-type": "image/png" }); res.end(png); });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as { port: number }).port;
  try {
    const { mirrorImage } = await import("@/lib/imageMirror");
    return await fn({
      mirror: mirrorImage,
      dir: join(work, "public", "uploads", "developments", "t"),
      src: `http://127.0.0.1:${port}/photo.png`,
      served: () => hits,
    });
  } finally {
    srv.close();
    process.chdir(cwd);
  }
}

const hashOf = (url: string) => url.match(/\/([a-f0-9]{16})_medium\.webp$/)![1];
const sizeOf = async (p: string) => (await stat(p)).size;

test("a fresh mirror writes all three variants with bytes in them", async () => {
  await withMirror(async ({ mirror, dir, src, served }) => {
    const r = await mirror(src, "t");
    assert.ok(r?.wasNew, "first mirror reports a new image");
    const h = hashOf(r!.url);
    for (const size of ["small", "medium", "large"]) {
      assert.ok(await sizeOf(join(dir, `${h}_${size}.webp`)) > 0, `_${size} has bytes`);
    }
    assert.equal(served(), 1, "source downloaded once");
    assert.equal((await mirror(src, "t"))?.wasNew, false, "a complete set is skipped");
    assert.equal(served(), 1, "a complete set is not re-downloaded");
  });
});

test("a 0-byte variant no longer counts as mirrored — the 2026-07-05 regression", async () => {
  await withMirror(async ({ mirror, dir, src, served }) => {
    const h = hashOf((await mirror(src, "t"))!.url);
    // Exactly the state island-blue-65/556ac05e8827b7a0_medium.webp was in.
    await writeFile(join(dir, `${h}_medium.webp`), Buffer.alloc(0));
    const healed = await mirror(src, "t");
    assert.equal(healed?.wasNew, true, "0-byte medium re-mirrors instead of being skipped forever");
    assert.equal(served(), 2, "the source really is fetched again");
    assert.ok(await sizeOf(join(dir, `${h}_medium.webp`)) > 0, "medium is restored");
  });
});

test("a missing variant also re-mirrors — three of the five never got a _large", async () => {
  await withMirror(async ({ mirror, dir, src }) => {
    const h = hashOf((await mirror(src, "t"))!.url);
    await unlink(join(dir, `${h}_large.webp`));
    assert.equal((await mirror(src, "t"))?.wasNew, true, "incomplete set re-mirrors");
    assert.ok(await sizeOf(join(dir, `${h}_large.webp`)) > 0, "large is restored");
  });
});

test("a failed mirror leaves the previous variants intact and no empty file behind", async () => {
  await withMirror(async ({ mirror, dir, src }) => {
    const h = hashOf((await mirror(src, "t"))!.url);
    const before = await readFile(join(dir, `${h}_medium.webp`));

    // An image content-type over a body sharp cannot decode: the failure lands
    // inside the write loop, which is where the original damage happened.
    const bad = createServer((_q, res) => { res.writeHead(200, { "content-type": "image/png" }); res.end(Buffer.from("not an image")); });
    await new Promise<void>((r) => bad.listen(0, "127.0.0.1", r));
    const badPort = (bad.address() as { port: number }).port;
    try {
      assert.equal(await mirror(`http://127.0.0.1:${badPort}/x.png`, "t"), null, "an undecodable source mirrors to null");
    } finally { bad.close(); }

    assert.ok(before.equals(await readFile(join(dir, `${h}_medium.webp`))), "the existing variant is untouched");
    const files = await readdir(dir);
    assert.deepEqual(files.filter((f) => f.includes(".tmp-")), [], "no temp files are left behind");
    for (const f of files) assert.ok(await sizeOf(join(dir, f)) > 0, `${f} is not empty`);
  });
});
