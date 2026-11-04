"""SOL Properties — the per-project Google Docs ("Info & Prices", "Prices & Availability")
-> unit status + price, as the list.json that apply-unit-list.mjs reads.

The Drive folder 'SOL | SALES' (144KyC9ohcQbmDM_Y68NT9jjPUXIszPNl) is link-shared, so
each doc exports as plain text without credentials
(docs.google.com/document/d/<id>/export?format=txt). Each unit is one free-text line
or short block, e.g.

    Ap201: 2bed 80.2sqm +29.7sqm reserved
    Ap 201 77sq.m + 26sq.m 390,000€
    MV02(typical) internal 228sq.m, covered 30sq.m, plot 276sq.m parkings 2
    682.400€

"sold" / "reserved" anywhere in the unit's text -> that status; otherwise the LAST
price-shaped number ("428’000€", "390,000€", "682.400€") -> available. A unit with
neither is an error, never a guess. Quarter's top-floor unit is written "Ap4"; it is
ref 401 in the DB.

Doc ids as of 2026-11-03 (a new doc in a project folder means a new id — re-list the
folder with embeddedfolderview if an export comes back as an HTML login page).

Usage: python3 sol-prices.py > list.json
"""
import json
import re
import sys
import urllib.request

DOCS = {
    "Keys": "1sJ1-ijV8JhEsCYlwATAkKYcO6CQEfDvERXYlErWERL4",
    "Hai": "1BqiiKNq1u8Mo3RWog6oTnPgq3-JWURBasTMzQ85Uwz4",
    "Quarter": "112ujl9TMcyMrWencncLeuwcObz9tZIj2KxaPlUJ5_pg",
    "Luna": "12VZEvrfwkHpOX0S4ydWPwXCFCZ12-ZCrwOn3VohpckU",
    "Yard": "11nhsW_aehPf5E9eO4P4RyzZdC726k50SyuT3Iny_0L0",
    "Echo": "113rgLV43Ret7tUTk8Nc9aIhxV-4uB16r-jZgzaV0Nk8",
    "Montville": "1UyWiS4ars96sMfrH8MemgZHX-x2Sit3YbpWqg74qbAU",
}


def export(doc_id):
    raw = urllib.request.urlopen(f"https://docs.google.com/document/d/{doc_id}/export?format=txt").read()
    text = raw.decode("utf-8-sig").replace("\r", "")
    if text.lstrip().startswith("<"):
        raise SystemExit(f"{doc_id}: export returned HTML, not text (doc moved or no longer shared)")
    return text


def parse(name, text):
    rows = []
    for part in re.split(r"(?=\bAp ?\d{1,3}\b|\bMV\d\d\b)", text):
        m = re.match(r"(?:Ap ?(\d{1,3})|(MV\d\d))", part)
        if not m:
            continue
        ref = m.group(1) or m.group(2)
        if name == "Quarter" and ref == "4":
            ref = "401"
        # a unit's text ends at the first blank line (Montville's trailing payment
        # plan and Benefits are separated by one); Echo puts the price on the next line
        body = part if name == "Echo" else part.split("\n\n")[0]
        low = body.lower()
        if "sold" in low:
            rows.append({"ref": ref, "status": "sold", "price": None})
        elif "reserved" in low:
            rows.append({"ref": ref, "status": "reserved", "price": None})
        else:
            prices = [int(re.sub(r"\D", "", x)[:6]) for x in re.findall(r"(\d{3}[’'.,]\d{3}(?:[.,]\d+)?)\s*€?", body)]
            if not prices:
                raise SystemExit(f"{name} {ref}: no price and no status in {body!r}")
            rows.append({"ref": ref, "status": "available", "price": prices[-1]})
    if not rows:
        raise SystemExit(f"{name}: no units read")
    return rows


if __name__ == "__main__":
    out = {name: parse(name, export(doc)) for name, doc in DOCS.items()}
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
