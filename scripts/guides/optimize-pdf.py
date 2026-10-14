# Usage: python3 scripts/guides/optimize-pdf.py <file.pdf> [more.pdf ...]
# Rewrites each PDF in place without changing a pixel or a character: drops unused objects, deduplicates, recompresses streams and packs
# objects into object streams. Headless Chrome (Skia) leaves most of that undone, so a guide shrinks by about 55%
# (760-940 KB -> 340-420 KB). The download goes to visitors on all kinds of connections, so size matters.
# It verifies the result (same page count, same text per page) before replacing the original, and exits non-zero otherwise.
import os, sys, tempfile
import fitz

def optimize(path):
    before = os.path.getsize(path)
    src = fitz.open(path)
    pages, texts = len(src), [p.get_text() for p in src]
    fd, tmp = tempfile.mkstemp(suffix=".pdf", dir=os.path.dirname(path) or ".")
    os.close(fd)
    try:
        src.save(tmp, garbage=4, deflate=True, deflate_fonts=True, deflate_images=True, use_objstms=1)
        src.close()
        out = fitz.open(tmp)
        if len(out) != pages or [p.get_text() for p in out] != texts:
            raise SystemExit(f"{path}: optimized copy differs (pages or text), original kept")
        out.close()
        after = os.path.getsize(tmp)
        if after >= before:
            os.remove(tmp)
            print(f"kept   {os.path.basename(path)} {before // 1024} KB (no gain)")
            return
        os.replace(tmp, path)
        print(f"packed {os.path.basename(path)} {before // 1024} KB -> {after // 1024} KB")
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    for p in sys.argv[1:]:
        optimize(p)
