"""Build the demo's offline MathJax SVG formulas and symbol table.

Source: model_spec.py. Requires Python 3.11+, Node.js 24 and npm ci.
Usage: python scripts/site/build_formulas.py [--check]
No Python packages, browser scripts or online rendering service are needed.
"""

from __future__ import annotations

import argparse
import json
import runpy
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify generated output without writing it.")
    args = parser.parse_args()
    spec = runpy.run_path(str(HERE / "model_spec.py"))
    sections = []
    number = 0
    for code, title, equations in spec["SECTIONS"]:
        items = []
        for heading, tex, description in equations:
            number += 1
            items.append({"n": number, "h": heading, "tex": tex, "p": description})
        sections.append({"c": code, "t": title, "eqs": items})
    groups = ["集合與下標", "決策變數", "預測", "成本", "計劃層", "評估"]
    symbols = [
        {"g": group, "tex": tex, "n": name, "path": path, "v": value, "u": unit, "src": source}
        for group, tex, name, path, value, unit, source in spec["SYMS"]
    ]
    symbols.sort(key=lambda row: groups.index(row["g"]))
    command = ["node", str(HERE / "typeset-formulas.mjs")]
    if args.check:
        command.append("--check")
    result = subprocess.run(
        command,
        input=json.dumps({"secs": sections, "syms": symbols}, ensure_ascii=False).encode("utf-8"),
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
