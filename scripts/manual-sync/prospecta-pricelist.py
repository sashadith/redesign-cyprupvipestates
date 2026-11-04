"""Prospecta Development — per-project price-list PDF -> units (status + price).

Prospecta shares ONE Drive folder per project (links in the DeveloperAccount
notes). Since October 2026 the price list sits in the folder root (Avenue: still
in PRICELIST/) as "<Project> Pricelist.pdf" (Breeze II: "Breeze Residences II.pdf")
on a redesigned one-page template. The text layer runs in reading order, one cell
per line:

    No. | Type | Bedrooms | <areas…> | Parking | Price
    101 | Apartment | 2 | 75 | 20 | – | 95 | 1 | € 380,000
    3A Type A | 5 | 400 | …            (ref and type can share one text run)
    7 | Villa B | 3 | … | R ES E RV E D (status words are letter-spaced)

A row is a ref followed by a type word; it ends at the first price or status cell.
SOLD / RESERVED -> that status, a price -> available. The page's own summary line
("Available 7 | Reserved 3 | Sold 5") is the check on the read: any count that does
not match is reported. Exit code 2 on any problem — never guess.

Usage: python3 prospecta-pricelist.py <pdf> [<pdf> ...]   -> JSON on stdout
       { "<pdf>": { "units": [{ref, type, beds, cells, status, price}], "problems": [...] } }
"""
import json
import re
import sys

import fitz

TYPE_RE = re.compile(r"(Apartment|Penthouse\*?|Type [A-Z]|Villa.*|Bungalow|Maisonette|House.*|Townhouse.*|Studio)", re.I)


def tokens(path):
    raw = [t.strip() for t in "\n".join(p.get_text() for p in fitz.open(path)).split("\n") if t.strip()]
    out = []
    for t in raw:
        m = re.fullmatch(r"(\d{1,3}[A-Z]?) (Type .+)", t)
        out.extend([m.group(1), m.group(2)] if m else [t])
    return out


def parse(path):
    toks = tokens(path)
    units, problems, i = [], [], 0
    while i < len(toks):
        t = toks[i]
        if re.fullmatch(r"\d{1,3}[A-Z]?", t) and i + 2 < len(toks) and TYPE_RE.fullmatch(toks[i + 1]):
            row, j = [t], i + 1
            while j < len(toks):
                row.append(toks[j])
                s = toks[j].replace(" ", "")
                if re.fullmatch(r"SOLD|RESERVED", s, re.I) or s.startswith("€"):
                    break
                j += 1
            last = row[-1].replace(" ", "").upper()
            status = "sold" if last == "SOLD" else "reserved" if last == "RESERVED" else "available"
            price = int(re.sub(r"\D", "", last)) if status == "available" and re.search(r"\d", last) else None
            if status == "available" and not price:
                problems.append(f"{row[0]}: no price or status in the last cell ({row[-1]!r})")
            units.append({"ref": row[0], "type": row[1].rstrip("*"), "beds": row[2], "cells": row[3:-1], "status": status, "price": price})
            i = j + 1
        else:
            i += 1
    text = " ".join(toks)
    for word, key in (("Available", "available"), ("Reserved", "reserved"), ("Sold", "sold")):
        m = re.search(rf"\b{word} (\d+)\b", text)
        n = sum(1 for u in units if u["status"] == key)
        if m and int(m.group(1)) != n:
            problems.append(f"summary says {word} {m.group(1)}, read {n}")
    if not units:
        problems.append("no unit rows read — template changed")
    return {"units": units, "problems": problems}


if __name__ == "__main__":
    out = {p: parse(p) for p in sys.argv[1:]}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    sys.exit(2 if any(v["problems"] for v in out.values()) else 0)
