"""Platon Properties — per-project price-list PDF -> units (status + price + areas).

Platon shares ONE Drive root (1-ENjvA90rn_bJuTumx_9KkOC57l2uBAl) with a folder
per project. Each folder holds its price list as a PDF, usually twice (branded and
"unbranded", EN and RU). Three different one-page templates, all read from the
text layer in reading order:

  Apartments  "1 | 1 Bedroom | 101 | 50 | 14 | 64 | Yes | 1 | SOLD / €230,000"
              (floor, type, unit, interior, veranda, total, storage, parking, price)
  Triangle    "Flat 101 | 1 | 108.9 | 25.1 | 134 | 3 | 3 | 1 | 1 | € 475,720"
              (flat, floor, interior, balcony, total, beds, baths, parking, storage, price)
  Villas      "No. 1 | B | 433 m² | 120 m² | 2 | 3 / 3 | 80 m² | 40 m² | 4 × 8 m | 2 | €606,000"
              (villa, type, plot, home, floors, beds/baths, covered, open, pool, parking, price)
              The status word is letter-spaced ("S O L D").

Platon Suites' list ("Price Suites ENG*.pdf") has NO text layer — its text is drawn
as outlines. It is reported as unreadable here; render it and transcribe by eye
(scripts/data/platon/<date>.json carries the transcription).

Every row is checked against its own total (interior + verandas = total); anything
that does not resolve to SOLD / RESERVED / a price, or does not add up, is reported,
never guessed. Exit code 2 when any file has a problem.

Usage: python3 platon-pricelist.py <pdf> [<pdf> ...]   -> JSON on stdout
"""
import json
import re
import sys

import fitz

NUM = r"(\d+(?:\.\d+)?)"


def flat_text(path):
    doc = fitz.open(path)
    text = " ".join(p.get_text() for p in doc)
    text = re.sub(r"\s+", " ", text)
    # letter-spaced status words ("S O L D", "R E S E R V E D")
    text = re.sub(r"\bS O L D\b", "SOLD", text)
    text = re.sub(r"\bR E S E R V E D\b", "RESERVED", text)
    return text


def outcome(cell):
    cell = cell.strip()
    if re.fullmatch(r"SOLD", cell, re.I):
        return "sold", None
    if re.fullmatch(r"RESERVED", cell, re.I):
        return "reserved", None
    m = re.fullmatch(r"€\s*([\d,]+)", cell)
    if m:
        return "available", int(m.group(1).replace(",", ""))
    return None, None


def check_total(problems, ref, parts, total):
    s = round(sum(parts), 2)
    if abs(s - total) > 0.6:
        problems.append({"ref": ref, "problem": f"areas {parts} add up to {s}, list says {total}"})


def parse(path):
    text = flat_text(path)
    units, problems = [], []
    if len(text.strip()) < 40:
        return {"file": path, "template": None, "units": [],
                "problems": [{"problem": "no text layer — render the page and transcribe it"}]}

    if "PLATON APARTMENTS" in text.replace("  ", " ") or "P L A T O N A P A R T M E N T S" in text:
        template = "apartments"
        row = re.compile(rf"(\d) (\d) Bedrooms? (\d{{3}}) {NUM} {NUM} {NUM} (Yes|No) (\d) (SOLD|RESERVED|€[\d,]+)")
        for m in row.finditer(text):
            floor, beds, ref, internal, veranda, total, storage, parking, cell = m.groups()
            status, price = outcome(cell)
            check_total(problems, ref, [float(internal), float(veranda)], float(total))
            units.append({"ref": ref, "floor": floor, "beds": int(beds), "internal": float(internal),
                          "veranda": float(veranda), "total": float(total), "storage": storage == "Yes",
                          "parking": int(parking), "status": status, "price": price})
    elif "TRIANGLE" in text.upper():
        template = "triangle"
        row = re.compile(rf"Flat (\d{{3}}) (\d) {NUM} {NUM} {NUM} (\d) (\d) (\d) (\d) (SOLD|RESERVED|€ ?[\d,]+)")
        for m in row.finditer(text):
            ref, floor, internal, balcony, total, beds, baths, parking, storage, cell = m.groups()
            status, price = outcome(cell)
            check_total(problems, ref, [float(internal), float(balcony)], float(total))
            units.append({"ref": ref, "floor": floor, "beds": int(beds), "baths": int(baths),
                          "internal": float(internal), "veranda": float(balcony), "total": float(total),
                          "parking": int(parking), "storage": int(storage) > 0, "status": status, "price": price})
    elif re.search(r"\bvillas?\b", text, re.I):
        template = "villas"
        row = re.compile(r"No\. (\d{1,2}) ([A-D]) (\d+) m² (\d+) m² (\d) (\d) / (\d) (\d+) m² (\d+) m² "
                         r"(\d) × (\d) m (\d) (SOLD|RESERVED|€[\d,]+)")
        for m in row.finditer(text):
            n, vtype, plot, home, floors, beds, baths, cov, opn, pw, pl, parking, cell = m.groups()
            status, price = outcome(cell)
            units.append({"ref": f"V{n}", "villaType": vtype, "plot": int(plot), "internal": int(home),
                          "floors": int(floors), "beds": int(beds), "baths": int(baths), "veranda": int(cov),
                          "terrace": int(opn), "pool": f"{pw} × {pl} m", "parking": int(parking),
                          "status": status, "price": price})
    else:
        return {"file": path, "template": None, "units": [], "problems": [{"problem": "unknown template"}]}

    for u in units:
        if u["status"] is None:
            problems.append({"ref": u["ref"], "problem": "status/price cell not understood"})
    if not units:
        problems.append({"problem": f"{template} template recognised but no unit rows read — layout changed"})
    return {"file": path, "template": template, "units": units, "problems": problems}


if __name__ == "__main__":
    out = [parse(p) for p in sys.argv[1:]]
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    if any(o["problems"] for o in out):
        sys.exit(2)
