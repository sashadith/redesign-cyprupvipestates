"""Prospecta Development — per-project price-list PDF -> units (status + price).

Prospecta shares ONE Drive folder per project; each holds PRICELIST/<project>.pdf
on the same one-page template: a header row, then one row per unit whose first
cell is the unit ref ("101", "7", "3A") and whose last cell is the status —
SOLD / RESERVED as a word, otherwise "€ 480,000" (= available). The text layer
is clean (no rotation, no colour coding), so rows are rebuilt from word
geometry: a row is every word sharing the ref's baseline. Anything that does
not resolve to SOLD / RESERVED / a price is reported, never guessed.
Usage: python3 prospecta-pricelist.py <pdf> [<pdf> ...]   -> JSON on stdout
"""
import json
import re
import sys

import fitz

REF_RE = re.compile(r"^\d{1,3}[A-Z]?$")


def parse(path):
    page = fitz.open(path)[0]
    words = page.get_text("words")  # x0,y0,x1,y1,text,block,line,wno
    head = next((w for w in words if w[4] == "Property"), None)
    if not head:
        raise ValueError(f"{path}: no 'Property' header — template changed")
    price_hdr = [w for w in words if w[4] == "Price" and abs(w[1] - head[1]) < 15]
    if not price_hdr:
        raise ValueError(f"{path}: no 'Price' header on the header row")
    price_x = price_hdr[0][0]
    ref_x1 = head[2] + 5
    units, problems = [], []
    for w in sorted(words, key=lambda w: (round(w[1]), w[0])):
        if w[1] <= head[3] + 2 or w[0] > ref_x1 or not REF_RE.match(w[4]):
            continue
        cy = (w[1] + w[3]) / 2
        row = [v for v in words if abs((v[1] + v[3]) / 2 - cy) < 4]
        tail = " ".join(v[4] for v in sorted(row, key=lambda v: v[0]) if v[0] >= price_x - 25)
        if re.search(r"\bSOLD\b", tail, re.I):
            status, price = "sold", None
        elif re.search(r"\bRESERVED\b", tail, re.I):
            status, price = "reserved", None
        else:
            m = re.search(r"€\s*([\d,.]+)", tail)
            if not m:
                problems.append({"ref": w[4], "tail": tail})
                continue
            status, price = "available", int(re.sub(r"[^\d]", "", m.group(1)))
        units.append({"ref": w[4], "status": status, "price": price,
                      "cells": " ".join(v[4] for v in sorted(row, key=lambda v: v[0]))})
    return {"file": path, "units": units, "problems": problems}


if __name__ == "__main__":
    out = [parse(p) for p in sys.argv[1:]]
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    if any(o["problems"] for o in out):
        sys.exit(2)
