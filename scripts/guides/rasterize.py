# Usage: python3 scripts/guides/rasterize.py <pdf> <outDir> [dpi]   -> <outDir>/<name>-p<N>.png ; prints page count
import sys, os, fitz
pdf, out = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 70
os.makedirs(out, exist_ok=True)
doc = fitz.open(pdf)
name = os.path.splitext(os.path.basename(pdf))[0]
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=dpi).save(os.path.join(out, f"{name}-p{i}.png"))
print(f"{name}: {len(doc)} pages")
