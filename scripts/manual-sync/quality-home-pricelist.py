"""Quality Home Developers — master price list PDF -> units per project.

One page per project (page 1 = overview). Each page: title row "<Project> - <Area>",
a header row, unit rows, a "Notes:" row, then Location / Marketing / Status lines.
The PDF's text layer is out of reading order, so rows are rebuilt from word
geometry: rows are anchored on the unit-reference cell (first column), columns on
the header labels. Status is the word in the price column (RESERVED / SOLD),
otherwise the price. Anything unparseable is reported, never guessed.
Usage: python3 parse_pricelist.py <pdf> [out.json]
"""
import json
import re
import sys

import fitz

REF_RE = re.compile(r"^([A-D]?\d{3}|Villa)$")
PRICE_RE = re.compile(r"^€\s?[\d,]+$")


def cluster(vals, gap):
    vals = sorted(vals)
    groups, cur = [], [vals[0]]
    for v in vals[1:]:
        if v - cur[-1] > gap:
            groups.append(cur)
            cur = [v]
        else:
            cur.append(v)
    groups.append(cur)
    return groups


def parse_page(page):
    # Pages are stored rotated; map word boxes into the visible (derotated) frame.
    m = page.rotation_matrix
    words = []
    for w in page.get_text("words"):  # x0,y0,x1,y1,text,block,line,wno
        r = fitz.Rect(w[:4]) * m
        words.append((r.x0, r.y0, r.x1, r.y1) + tuple(w[4:]))
    text = page.get_text()
    title = next((l.strip() for l in text.splitlines() if " - " in l and not l.startswith("http")), None)
    if not title:
        return None
    notes_y = min([w[1] for w in words if w[4] == "Notes:"] or [1e9])
    # unit reference cells: leftmost column words matching a ref
    left = min(w[0] for w in words if w[4] in ("Apartment", "Bedrooms", "Bedroom"))  # header left edge
    refs = []
    for w in words:
        if w[1] < notes_y and w[0] < left + 60 and REF_RE.match(w[4]):
            if w[4] == "Villa":
                nxt = next((v for v in words if abs(v[1] - w[1]) < 2 and v[0] > w[2] and v[0] - w[2] < 15), None)
                refs.append((w, f"Villa {nxt[4]}" if nxt else "Villa"))
            else:
                refs.append((w, w[4]))
    if not refs:
        return {"title": title, "units": [], "notes": "", "status": "", "location": ""}
    refs.sort(key=lambda r: r[0][1])
    header_bottom = refs[0][0][1] - 2
    header_top = max(w[3] for w in words if title.split(" - ")[0].split()[0] in w[4] and w[1] < header_bottom)
    hdr = [w for w in words if header_top < w[1] < header_bottom]
    # columns: the table's own vertical grid lines (drawn in the PDF) give the
    # exact boundaries; header words are then assigned to those cells.
    xs = []
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                a, b = it[1] * m, it[2] * m
                if abs(a.x - b.x) < 1 and abs(a.y - b.y) > 8 and min(a.y, b.y) <= header_bottom and max(a.y, b.y) >= header_top:
                    xs.append(a.x)
            elif it[0] == "re":
                r = it[1] * m
                if r.width < 2 and r.height > 8 and r.y0 <= header_bottom and r.y1 >= header_top:
                    xs.append((r.x0 + r.x1) / 2)
                elif r.height > 8 and r.y0 <= header_bottom and r.y1 >= header_top and r.width < 300:
                    xs.extend([r.x0, r.x1])
    xs = [sum(g) / len(g) for g in cluster(xs, 2)] if xs else []
    cols = []
    for a, b in zip(xs, xs[1:]):
        ws = [w for w in hdr if a - 1 <= (w[0] + w[2]) / 2 <= b + 1]
        if not ws:
            continue
        cols.append({"x0": a, "x1": b, "words": ws})
    for c in cols:
        c["label"] = " ".join(x[4] for x in sorted(c["words"], key=lambda x: (round(x[1]), x[0])))
        c["cx"] = (c["x0"] + c["x1"]) / 2
    cols.sort(key=lambda c: c["cx"])
    # row bands from ref anchors
    ys = [(r[0][1] + r[0][3]) / 2 for r in refs]
    bands = []
    for i, (w, ref) in enumerate(refs):
        top = (ys[i - 1] + ys[i]) / 2 if i else header_bottom
        bot = (ys[i] + ys[i + 1]) / 2 if i + 1 < len(refs) else notes_y
        bands.append((ref, top, bot))
    units = []
    for ref, top, bot in bands:
        cells = {c["label"]: [] for c in cols}
        for w in words:
            cy = (w[1] + w[3]) / 2
            if not (top <= cy < bot):
                continue
            cx = (w[0] + w[2]) / 2
            inside = [c for c in cols if c["x0"] - 1 <= cx <= c["x1"] + 1]
            c = inside[0] if inside else min(cols, key=lambda c: abs(c["cx"] - cx))
            cells[c["label"]].append(w)
        row = {lab: " ".join(x[4] for x in sorted(ws, key=lambda x: (round(x[1] / 3), x[0]))) for lab, ws in cells.items()}
        units.append({"ref": ref, "cells": row})
    def after(label):
        m = re.search(label + r":\s*\n?\s*(.+)", text)
        return m.group(1).strip() if m else ""
    notes = re.search(r"Notes:\s*(.+?)(?:\n[A-Z][a-z]+:|\Z)", text.replace("\n", " ") + "\n", re.S)
    links = re.findall(r"https?://\S+", text)
    status = re.search(r"((?:OFF-PLAN|UNN?DER\s*CONSTRUCTION|COMPLETED)[^\n]*)", text)
    return {"title": title, "columns": [c["label"] for c in cols], "units": units,
            "notes": " ".join((notes.group(1) if notes else "").split()),
            "links": links, "status": status.group(1).strip() if status else ""}


def normalize(page):
    out = []
    for u in page["units"]:
        c = {k.lower(): v for k, v in u["cells"].items()}
        def get(*keys):
            for k, v in c.items():
                if any(key in k for key in keys):
                    return v
            return ""
        price_raw = get("price")
        if re.search(r"\bSOLD\b", price_raw):
            status, price = "sold", None
        elif re.search(r"RESERVED", price_raw):
            status, price = "reserved", None
        else:
            m = re.search(r"€\s?([\d,]+)", price_raw)
            status, price = ("available", int(m.group(1).replace(",", ""))) if m else ("UNKNOWN", None)
        out.append({
            "ref": u["ref"], "status": status, "price": price,
            "beds": get("bedroom"), "baths": get("bath"),
            "internal": get("built area", "internal"), "veranda": get("covered verandas", "verandas"),
            "covered_total": get("total covered"), "storage": get("storage"), "roof": get("roof"),
            "total": get("total area"), "parking": get("parking"), "view": get("view"),
            "plot": get("plot"), "raw": u["cells"],
        })
    return out


if __name__ == "__main__":
    doc = fitz.open(sys.argv[1])
    result = []
    for i in range(1, len(doc)):
        p = parse_page(doc[i])
        if not p:
            continue
        p["units_norm"] = normalize(p)
        result.append(p)
    if len(sys.argv) > 2:
        json.dump(result, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
    for p in result:
        print(f"\n## {p['title']}  | status: {p['status']}\n   columns: {p.get('columns')}")
        for u in p["units_norm"]:
            print(f"   {u['ref']:8} {u['status']:9} {str(u['price'] or ''):8} beds={u['beds']} baths={u['baths']} int={u['internal']} ver={u['veranda']} roof={u['roof']} tot={u['total']} park={u['parking']} view={u['view']}")
