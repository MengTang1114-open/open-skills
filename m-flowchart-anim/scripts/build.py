#!/usr/bin/env python3
"""Build a self-contained animated flowchart HTML from a JSON spec.

usage: build.py spec.json -o out.html [--style NAME] [--bgm steady|pulse|drive|none|path/to/audio]

--bgm defaults to spec.bgm, else the preset whose default_for matches the style.
With a BGM, step timings snap to its beat grid and record.py muxes the audio.
"""
import argparse, json, sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
STYLES = sorted(p.stem for p in (ASSETS / "styles").glob("*.html"))
BGM_DIR = ASSETS / "bgm"
LIMITS = {"nodes": 14, "per_rank": 4, "ranks": 7, "label": 18, "desc": 40}


def pick_layout(spec):
    """flow or hub, as runtime.js pickLayout() decides it."""
    if spec.get("layout") in ("flow", "hub"):
        return spec["layout"]
    nodes, edges = spec["nodes"], [e for e in spec.get("edges", []) if e["from"] != e["to"]]
    nb = {n["id"]: set() for n in nodes}
    for e in edges:
        nb[e["from"]].add(e["to"]); nb[e["to"]].add(e["from"])
    hub = max(nb, key=lambda k: len(nb[k]))
    touching = sum(1 for e in spec.get("edges", []) if hub in (e["from"], e["to"]))
    ok = len(nodes) >= 5 and len(nb[hub]) >= max(4, 0.6 * (len(nodes) - 1)) and touching >= 0.7 * len(spec.get("edges", []))
    return "hub" if ok else "flow"


def rank_rows(spec):
    """Rows of node ids as the flow layout will stack them (mirrors runtime.js layoutFlow)."""
    order = [nid for s in spec.get("steps", []) for nid in s.get("nodes", [])]
    ids = [n["id"] for n in spec["nodes"]]
    stepk = {}
    for k, s in enumerate(spec.get("steps", [])):
        for nid in s.get("nodes", []):
            stepk.setdefault(nid, k)
    for nid in ids:
        stepk.setdefault(nid, len(stepk) + 1000)
    fwd = [(e["from"], e["to"]) for e in spec.get("edges", [])
           if e["from"] != e["to"] and stepk[e["to"]] >= stepk[e["from"]]]
    rank = dict.fromkeys(ids, 0)
    for _ in ids:  # longest path by relaxation; the forward graph is acyclic
        for a, b in fwd:
            rank[b] = max(rank[b], rank[a] + 1)
    rows = [[] for _ in range(max(rank.values()) + 1)]
    for nid in ids:
        rows[rank[nid]].append(nid)
    return rows


def check(spec):
    """Return (errors, warnings) for a spec."""
    errs, warns = [], []
    nodes = spec.get("nodes") or []
    if not nodes:
        errs.append("spec.nodes is empty")
    ids = [n.get("id") for n in nodes]
    if len(set(ids)) != len(ids) or None in ids:
        errs.append("node ids must be present and unique")
    idset = set(ids)
    for e in spec.get("edges", []):
        if e.get("from") not in idset or e.get("to") not in idset:
            errs.append(f"edge {e} points at an unknown node")
    for s in spec.get("steps", []):
        for nid in s.get("nodes", []):
            if nid not in idset:
                errs.append(f"step {s.get('title') or s.get('caption')} names unknown node {nid}")
    if len(nodes) > LIMITS["nodes"]:
        warns.append(f"{len(nodes)} nodes; above {LIMITS['nodes']} the boxes get small - merge steps")
    for n in nodes:
        if len(n.get("label", "")) > LIMITS["label"]:
            warns.append(f"label too long ({len(n['label'])} chars): {n['label']}")
        if len(n.get("desc", "")) > LIMITS["desc"]:
            warns.append(f"desc too long ({len(n['desc'])} chars): {n['desc']}")
    if not errs and pick_layout(spec) == "flow":
        ranks = rank_rows(spec)
        if len(ranks) > LIMITS["ranks"]:
            warns.append(f"{len(ranks)} rows deep; above {LIMITS['ranks']} the boxes shrink and lose their desc - "
                         "merge consecutive nodes, or run sequential nodes side by side in one step")
        for r, row in enumerate(ranks):
            if len(row) > LIMITS["per_rank"]:
                warns.append(f"row {r + 1} has {len(row)} nodes ({', '.join(row)}); keep it to {LIMITS['per_rank']}")
    if spec.get("style") and spec["style"] not in STYLES:
        errs.append(f"unknown style {spec['style']}; have {STYLES}")
    return errs, warns


def presets():
    f = BGM_DIR / "presets.json"
    return json.loads(f.read_text()) if f.exists() else {}


def resolve_bgm(name, style):
    """Return the spec.bgm dict for a preset name / audio path, or None."""
    ps = presets()
    if name is None:
        name = next((k for k, v in ps.items() if style in v.get("default_for", [])), "none")
    if name in (None, "none", ""):
        return None
    if name in ps:
        p = dict(ps[name], name=name)
        p["file"] = str((BGM_DIR / p["file"]).resolve())
        if not Path(p["file"]).exists():
            print(f"warn: bgm file missing: {p['file']} (see assets/bgm/README.md); building without music", file=sys.stderr)
            return None
        return p
    if Path(name).exists():  # arbitrary audio file: no beat grid, no loop points
        return {"name": Path(name).stem, "file": str(Path(name).resolve())}
    sys.exit(f"error: unknown bgm {name!r}; presets: {sorted(ps)} or an audio file path")


def build(spec, style):
    tpl = (ASSETS / "styles" / f"{style}.html").read_text()
    css = (ASSETS / "base.css").read_text() + (ASSETS / "styles" / f"{style}.css").read_text()
    js = (ASSETS / "runtime.js").read_text()
    data = json.dumps(spec, ensure_ascii=False).replace("</", "<\\/")
    title = spec.get("title", "flowchart")
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>{css}</style></head>
<body>
{tpl}
<script>window.SPEC = {data};</script>
<script>{js}</script>
</body></html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--style", choices=STYLES)
    ap.add_argument("--bgm", help="preset name, audio file path, or none")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    style = a.style or spec.get("style") or "paper"
    errs, warns = check(spec)
    for w in warns:
        print("warn:", w, file=sys.stderr)
    if errs:
        for e in errs:
            print("error:", e, file=sys.stderr)
        sys.exit(1)
    bgm = resolve_bgm(a.bgm if a.bgm is not None else spec.get("bgm"), style)
    spec = dict(spec, style=style)
    spec.pop("beat", None)
    if bgm:
        spec["bgm"] = bgm
        if bgm.get("period"):
            spec["beat"] = {"period": bgm["period"], "first_beat": bgm["first_beat"]}
    else:
        spec.pop("bgm", None)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(build(spec, style))
    print(a.out, f"(style={style}, bgm={bgm['name'] if bgm else 'none'})")


if __name__ == "__main__":
    main()
