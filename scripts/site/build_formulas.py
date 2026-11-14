"""Typeset the model formulas and symbol table for the demo.

把公式与符号表排版为向量 SVG，写入 site/assets/data/model-formulas.js。
Typeset formulas and the symbol table as vector SVG (STIX math font via matplotlib)
and write site/assets/data/model-formulas.js. The source of truth is model_spec.py.

Usage:  python scripts/site/build_formulas.py
Needs:  matplotlib>=3.8   (output is visually identical across versions; bytes may differ)
"""

from __future__ import annotations

import html
import io
import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

matplotlib.rcParams["mathtext.fontset"] = "stix"
matplotlib.rcParams["svg.fonttype"] = "path"
HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "site" / "assets" / "data" / "model-formulas.js"
INK = "#0d3a38"
spec: dict = {}
exec((HERE / "model_spec.py").read_text(encoding="utf-8"), spec)  # defines SECTIONS and SYMS


def fix_argmin(t: str) -> str:
    while r"\argmin_{" in t:
        i = t.find(r"\argmin_{")
        j = k = i + len(r"\argmin_{")
        depth = 1
        while depth:
            if t[k] == "\\":
                k += 2
                continue
            depth += {"{": 1, "}": -1}.get(t[k], 0)
            k += 1
        t = t[:i] + r"\underset{" + t[j:k - 1] + r"}{\mathrm{arg\,min}}" + t[k:]
    return t


def mathtext(t: str) -> str:
    t = fix_argmin(t)
    for a, b in [(r"\Big", ""), (r"\big", ""), (r"\mathbb{1}", r"\mathbf{1}"), (r"\Pr", r"\mathrm{Pr}"),
                 (r"\setminus", r"\backslash"), (r"\mathrm{CO_2}", r"\mathrm{CO}_2")]:
        t = t.replace(a, b)
    t = re.sub(r"\\le(?![a-z])", r"\\leq", t)
    return re.sub(r"\\ge(?![a-z])", r"\\geq", t)


def svg(t: str, size: float, uid: str, label: str) -> str:
    fig = plt.figure(figsize=(0.01, 0.01))
    fig.text(0, 0, "$" + mathtext(t) + "$", fontsize=size, color=INK)
    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight", pad_inches=0.03, transparent=True)
    plt.close(fig)
    s = re.sub(r"<\?xml.*?\?>\s*|<!DOCTYPE.*?>\s*|<metadata>.*?</metadata>\s*", "", buf.getvalue(), flags=re.S)
    s = re.sub(r'( d="[^"]*")', lambda m: re.sub(r"(-?\d+\.\d)\d+", r"\1", m.group(1)), s)
    s = re.sub(r"\n\s*", "\n", s)
    w = float(re.search(r'width="([\d.]+)pt"', s).group(1))
    h = float(re.search(r'height="([\d.]+)pt"', s).group(1))
    for i in sorted(set(re.findall(r'id="([^"]+)"', s)), key=len, reverse=True):
        s = s.replace(f'id="{i}"', f'id="{uid}-{i}"').replace(f'href="#{i}"', f'href="#{uid}-{i}"')
    s = re.sub(r'width="[\d.]+pt" height="[\d.]+pt"',
               f'width="{w / size:.3f}em" height="{h / size:.3f}em" role="img" aria-label="{html.escape(label)}" focusable="false"', s, count=1)
    s = s.replace(' xmlns:xlink="http://www.w3.org/1999/xlink"', "").replace("xlink:href=", "href=")
    return re.sub(r'<g id="[^"]*patch_1">\s*<path d="[^"]*"\s*style="fill: none"/>\s*</g>', "", s)


def main() -> None:
    n, secs = 0, []
    for code, title, eqs in spec["SECTIONS"]:
        items = []
        for head, tex, desc in eqs:
            n += 1
            items.append({"n": n, "h": head, "mml": svg(tex, 16, f"q{n}", head), "p": desc})
        secs.append({"c": code, "t": title, "eqs": items})
    order = ["集合與下標", "決策變數", "預測", "成本", "計劃層", "評估"]
    syms = [{"g": g, "s": svg(t, 15, f"y{k}", name), "n": name, "path": path, "v": v, "u": u, "src": src}
            for k, (g, t, name, path, v, u, src) in enumerate(spec["SYMS"])]
    syms.sort(key=lambda r: order.index(r["g"]))
    header = ("/* Pre-typeset formulas (STIX, vector) and symbol table — built by scripts/site/build_formulas.py.\n"
              " * Generated file — see docs/DATA.md for provenance. Do not edit by hand. */\n")
    OUT.write_text(header + "const MODEL9=" + json.dumps({"secs": secs, "syms": syms}, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"{n} formulas, {len(syms)} symbols -> {OUT}")


if __name__ == "__main__":
    main()
