# Rebuilds 2026-11-12.json (sync input) + media-manifest from facts/, media/, units-<date>.json, account.json.
# usage (from the repo root): python3 scripts/data/karma/combine.py .
# Builds WT/scripts/data/karma/2026-11-12.json (sync input) and media-manifest-2026-11-12.json
# from facts/<slug>.json (agents), units-2026-11-12.json (price list) and account.json.
import json, os, sys
WT = sys.argv[1]; D = f"{WT}/scripts/data/karma"
units = json.load(open(f"{D}/units-2026-11-12.json"))
account = json.load(open(f"{D}/account.json"))
ORDER = ["semera-beachfront","ionion-seafront-villas","malama-seafront-c","alaya-eco-friendly-villas","almaria-residences-phase-e","ariel-residences","olivia-residences","narine-villas","fig-tree-residences","amaya","nour-residences","lyra-residences","thea-residences-2"]
projects, manifest, missing = [], {}, []
for slug in ORDER:
    fp = f"{D}/facts/{slug}.json"
    if not os.path.exists(fp): missing.append(slug); continue
    f = json.load(open(fp))
    us = units[slug]
    if slug == "ionion-seafront-villas":
        for u in us: u["furnished"] = True
    proj = {k: f.get(k) for k in ["slug","name","category","stage","completion","energy","district","town","area","latitude","longitude","amenities","facts","totalUnitsInScheme","pinSource","sources","conflicts","openQuestions"]}
    proj["priceListDate"] = "2026-11-12"
    proj["units"] = us
    projects.append(proj)
    mp = f"{D}/media/{slug}.json"
    if os.path.exists(mp): manifest[slug] = {"gallery": json.load(open(mp))["gallery"]}
out = {"source": "Karma Developers' MASTER PRICELIST – CURRENT PROJECTS (2 pages, received by the operator 2026-11-12, VAT not included) for units and prices; their SharePoint share (link only in DeveloperAccount.developerCloudUrl) for renders, plans, specifications, presentations and descriptions; karmadevelopers.com for company facts.",
       "account": account, "projects": projects}
json.dump(out, open(f"{D}/2026-11-12.json","w"), indent=1, ensure_ascii=False)
json.dump(manifest, open(f"{D}/media-manifest-2026-11-12.json","w"), indent=1, ensure_ascii=False)
print(len(projects), "projects;", sum(len(p["units"]) for p in projects), "units; media for", len(manifest), "; missing facts:", missing)
