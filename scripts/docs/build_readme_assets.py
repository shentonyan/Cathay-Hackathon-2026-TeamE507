"""Regenerate four Chinese-first README PNGs from the shipped app calculations.

Use the explicit Python interpreter chosen for this project, after npm ci:
    <python.exe> scripts/docs/build_readme_assets.py --qa-dir <output-directory>
Optional: --font <CJK-font-file> (Microsoft JhengHei, Noto Sans CJK TC, etc.).
The browser demo needs none of these plotting dependencies.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.lines import Line2D
from matplotlib.patches import FancyBboxPatch, Patch
from matplotlib.ticker import FuncFormatter, MaxNLocator
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "assets"
WIDTH, DPI = 1500, 150
JADE, DARK, MINT = "#006564", "#0d3a38", "#76b7a7"
MUTED, GRID, RED, GOLD = "#647b78", "#e3ece8", "#d64750", "#d6a021"
FONT = None
FONT_FAMILY = None


def font_path(explicit: str | None) -> str:
    if explicit:
        path = Path(explicit).resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        return str(path)
    windows = Path("C:/Windows/Fonts/msjh.ttc")
    if windows.is_file():
        return str(windows)
    for family in ("Noto Sans CJK TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei"):
        try:
            return font_manager.findfont(font_manager.FontProperties(family=family), fallback_to_default=False)
        except ValueError:
            continue
    raise RuntimeError("Install Noto Sans CJK TC or pass --font with a Chinese font file.")


def txt(fig, x, y, text, size=12, color=DARK, weight="normal", ha="left", **kwargs):
    prop = font_manager.FontProperties(family=[FONT_FAMILY, "DejaVu Sans"], size=size, weight=weight)
    return fig.text(x, y, text, fontproperties=prop, color=color, ha=ha, va="center", **kwargs)


def canvas(height):
    return plt.figure(figsize=(WIDTH / DPI, height / DPI), dpi=DPI, facecolor="white")


def finish(fig, name, qa):
    path = OUT / name
    fig.savefig(path, dpi=DPI, facecolor=fig.get_facecolor(), metadata={"Software": "Cathay AaaS README figure builder"})
    if qa:
        shutil.copyfile(path, qa / name)
        fig.savefig(qa / name.replace(".png", ".svg"), metadata={"Date": None})
    plt.close(fig)


def axes_style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color(GRID)
    ax.tick_params(colors=MUTED, labelsize=11, length=4)
    ax.grid(axis="y", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)


def title(fig, main, sub):
    txt(fig, 0.065, 0.945, main, 20, weight="bold")
    txt(fig, 0.065, 0.893, sub, 10.8, color=MUTED)


def banner(data, qa):
    top = data["carbon"]["tiers"][3]
    fig = canvas(650)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    colors = np.array([[0, 0.23, 0.23], [0, 0.43, 0.42]])
    grad = np.linspace(0, 1, WIDTH)[None, :, None]
    ax.imshow(colors[0] * (1 - grad) + colors[1] * grad, extent=[0, 1, 0, 1], aspect="auto")
    txt(fig, 0.055, 0.91, "國泰創新挑戰賽 2026  ·  E507  ·  Wildcard", 11, color="#b4ddd6")
    txt(fig, 0.055, 0.79, "Cathay AaaS｜維修決策訂閱服務", 27, color="white", weight="bold")
    txt(fig, 0.055, 0.655, "每項維修，落在最划算又安全的那一天。", 24, color="white", weight="bold")
    txt(fig, 0.055, 0.565, "Every maintenance job, on its cheapest safe day.", 12, color="#c8e6df")
    txt(fig, 0.055, 0.465, "全集團推廣情景：耗油改善 2%，100% 落實  /  Group roll-out scenario", 10.8, color="white")
    cards = [
        ("每年潛在燃油節省", f"HK${top['save'] / 1e6:.0f}M", "Potential annual fuel saving"),
        ("每年潛在減少 CO₂", f"{top['co2'] / 1000:.0f} 千噸", "Potential annual CO₂ avoided"),
        ("可縮小 2030 碳強度差距", f"{top['pct']:.1f}%", "Share of the remaining 2030 gap"),
    ]
    for index, (label, value, english) in enumerate(cards):
        x, width = 0.055 + index * 0.305, 0.268
        fig.add_artist(FancyBboxPatch((x, 0.19), width, 0.205, transform=fig.transFigure,
            boxstyle="round,pad=0.008,rounding_size=0.018", linewidth=0.8,
            edgecolor="#4d9993", facecolor="#267d79"))
        txt(fig, x + 0.016, 0.355, label, 12, color="#d2eae4")
        txt(fig, x + 0.016, 0.283, value, 26, color="white", weight="bold")
        txt(fig, x + 0.016, 0.225, english, 9.2, color="#c8e6df")
    txt(fig, 0.055, 0.112, "推廣情景須經試點驗證；未扣新增維修、設備及平台成本。Demo 營運資料為合成。", 10, color="#c8e6df")
    txt(fig, 0.055, 0.056, "Scenario, not realized results. Requires pilot validation; excludes incremental implementation costs.", 9.1, color="#afd5cf")
    finish(fig, "banner.zh-Hant.png", qa)


def cost_curve(data, qa):
    curve = data["curve"]
    points = curve["points"]
    fig = canvas(940)
    title(fig, "等待的代價：太早浪費壽命，太晚放大風險", "DEMO-07｜2 號發動機更換 · Cost of waiting (R1)")
    ax = fig.add_axes([0.095, 0.285, 0.85, 0.535])
    axes_style(ax)
    days = np.array([point["day"] for point in points])
    ymin = min(points, key=lambda point: point["total"])
    ceiling = max(curve["referenceMinimum"] * 2.8, 1000) / 1000
    start, end = curve["economicWindow"]
    ax.axvspan(start, end, color="#e4f2eb", alpha=1)
    specs = [
        ("aog", "停飛預期損失 / AOG", RED, "-", 1.8),
        ("fuel", "燃油 / Fuel", GOLD, "-", 1.6),
        ("carbon", "碳成本 / Carbon", "#a88a3f", "--", 1.5),
        ("life", "未用壽命 / Life", "#929ba5", "--", 1.7),
        ("exec", "維修執行 / Execution", "#5b7c8c", ":", 1.7),
        ("total", "參照總成本 / Total", DARK, "-", 3),
    ]
    handles = []
    for key, label, color, style, width in specs:
        line, = ax.plot(days, [point[key] / 1000 for point in points], color=color, linestyle=style, linewidth=width, label=label)
        handles.append(line)
    ax.axvline(curve["jointDay"], color=JADE, linewidth=1.9)
    ax.axvline(curve["riskDay"], color="#a9333e", linestyle="--", linewidth=1.5)
    ax.plot(ymin["day"], ymin["total"] / 1000, "o", color=DARK, markeredgecolor="white", markeredgewidth=2, markersize=7)
    ax.text((start + end) / 2, ceiling * 0.93, "最佳經濟窗口", color="#25856d", fontsize=11.5, ha="center", weight="bold")
    ax.text((start + end) / 2, ceiling * 0.865, f"第 {start:g}–{end:g} 天", color="#25856d", fontsize=10.5, ha="center")
    ax.annotate("參照曲線最低點", xy=(ymin["day"], ymin["total"] / 1000),
        xytext=(max(1, ymin["day"] - 4), ymin["total"] / 1000 - ceiling * 0.17),
        fontsize=10.5, color=DARK,
        bbox={"boxstyle": "round,pad=0.22", "facecolor": "white", "edgecolor": "none", "alpha": 0.95},
        arrowprops={"arrowstyle": "-", "color": DARK, "lw": 0.8})
    ax.text(curve["jointDay"] + 0.3, ceiling * 0.68, f"聯合排程\n第 {curve['jointDay']:g} 天", color=JADE, fontsize=11, weight="bold")
    ax.text(curve["riskDay"] + 0.3, ceiling * 0.75, f"模型風險截止\n失效概率 {curve['riskCap']:.0%}", color="#a9333e", fontsize=10.5)
    ax.set(xlim=(0, min(float(days.max()), max(19, np.ceil(curve["riskDay"] + 2)))), ylim=(0, ceiling))
    ax.set_xlabel("執行日（距今天數） / Execution day", fontsize=12, labelpad=10, color=MUTED)
    ax.set_ylabel("預期成本（千港元） / Cost (HK$ k)", fontsize=12, labelpad=11, color=MUTED)
    ax.xaxis.set_major_locator(MaxNLocator(integer=True, nbins=8))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:,.0f}"))
    fig.legend(handles=handles, loc="lower center", bbox_to_anchor=(0.51, 0.11), ncol=3,
        frameon=False, fontsize=10.3, handlelength=2.2, columnspacing=2.4)
    txt(fig, 0.065, 0.088, "相同參照條件：香港過夜停場、在站庫存；實際方案成本另計窗口與共用資源因素。", 9.8, color=MUTED)
    txt(fig, 0.065, 0.045, "合成營運示例；8% 為模型設定上限，建議不等於適航放行。 / Synthetic operations; not airworthiness release.", 9.3, color=MUTED)
    finish(fig, "cost-of-waiting.zh-Hant.png", qa)


def rolling_year(data, qa):
    annual, periods = data["annual"], data["periods"]
    fig = canvas(900)
    title(fig, "把排程滾動一年，而不是把一期乘以 26", f"基準情景 / Base · 26 期 × 14 天 · {annual['n']} 項合成工作")
    txt(fig, 0.065, 0.841, f"全年總成本減少 HK${annual['save'] / 1e6:.2f}M  ·  降幅 {annual['pct']:.1%}  ·  減少 CO₂ {annual['co2']:,.0f} 噸", 12.1, color=JADE, weight="bold")
    ax = fig.add_axes([0.09, 0.265, 0.81, 0.51])
    axes_style(ax)
    sequence = [period["k"] for period in periods]
    savings = np.array([period["save"] / 1e6 for period in periods])
    cumulative = savings.cumsum()
    colors = [JADE if period["season"] > 1.05 else MINT for period in periods]
    ax.bar(sequence, savings, width=0.76, color=colors, alpha=0.88)
    right = ax.twinx()
    right.spines[["top", "left"]].set_visible(False)
    right.spines[["right", "bottom"]].set_color(GRID)
    right.tick_params(colors=MUTED, labelsize=11)
    right.plot(sequence, cumulative, color=JADE, linewidth=2.8)
    right.plot(sequence[-1], cumulative[-1], "o", color=JADE, markersize=5)
    right.annotate(f"累計 HK${annual['save'] / 1e6:.2f}M", xy=(sequence[-1], cumulative[-1]),
        xytext=(20, 22.7), fontsize=10.5, color=JADE, weight="bold",
        arrowprops={"arrowstyle": "-", "color": JADE, "lw": 0.8})
    ax.set(xlim=(0.3, 27), ylim=(0, float(savings.max()) * 1.18))
    right.set_ylim(0, 24.5)
    ax.set_xticks([1, 5, 10, 15, 20, 26])
    ax.set_xlabel("期數（每期 14 天） / Period", fontsize=12, color=MUTED, labelpad=10)
    ax.set_ylabel("每期節省（百萬港元）", fontsize=12, color=MUTED, labelpad=12)
    right.set_ylabel("累計節省（百萬港元）", fontsize=12, color=MUTED, labelpad=12)
    fig.legend(handles=[Patch(facecolor=MINT, label="每期節省（柱） / Per period"),
        Line2D([0], [0], color=JADE, linewidth=2.8, label="累計節省（線） / Cumulative")],
        loc="lower center", bbox_to_anchor=(0.5, 0.09), ncol=2, frameon=False, fontsize=10.5, columnspacing=3)
    txt(fig, 0.065, 0.084, f"模擬起點 {periods[0]['date']}；備件返修跨期延續，旺季背景工時按原模型設定。", 9.8, color=MUTED)
    txt(fig, 0.065, 0.043, "合成營運模擬；節省為模型內五項成本差額，並非已實現的財務收益。 / Simulated, not realized savings.", 9.4, color=MUTED)
    finish(fig, "rolling-year.zh-Hant.png", qa)


def carbon_target(data, qa):
    carbon, tiers = data["carbon"], data["carbon"]["tiers"]
    fig = canvas(920)
    title(fig, "國泰 2030 目標：四個累積級別，不能相加", f"集團碳強度 746 → 670 g CO₂／RTK · 剩餘差距 {carbon['gap']:g} g · 100% 落實情景")
    ax = fig.add_axes([0.32, 0.28, 0.36, 0.515])
    axes_style(ax)
    ax.grid(False, axis="y")
    ax.grid(axis="x", color=GRID, linewidth=0.7)
    positions = [3, 2, 1, 0]
    colors = ["#a8d3c9", "#6fb3a5", "#2f8f86", JADE]
    ax.barh(positions, [tier["pct"] for tier in tiers], color=colors, height=0.5)
    ax.spines["left"].set_visible(False)
    ax.set(yticks=[], ylim=(-0.5, 3.5), xlim=(0, 21))
    ax.set_xticks([0, 5, 10, 15, 20])
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:g}%"))
    labels = [
        ("① 本期排程，滾動一年", "Rolling-year model"),
        ("② 全集團推廣四項措施", "Group roll-out"),
        ("③ 機身性能保持 1%", "Airframe 1%"),
        ("④ 機身＋發動機 2%", "Airframe + engine 2%"),
    ]
    txt(fig, 0.77, 0.828, "縮小差距", 10.5, color=MUTED, ha="center")
    txt(fig, 0.94, 0.828, "每年減少 CO₂", 10.5, color=MUTED, ha="right")
    for index, (tier, (label, english)) in enumerate(zip(tiers, labels)):
        y = 0.28 + (positions[index] + 0.5) / 4 * 0.515
        txt(fig, 0.055, y + 0.012, label, 12.5, weight="bold")
        txt(fig, 0.055, y - 0.028, english, 9.8, color=MUTED)
        txt(fig, 0.77, y + 0.012, f"{tier['pct']:.1f}%", 17, color=colors[index] if index else DARK, ha="center", weight="bold")
        txt(fig, 0.77, y - 0.028, f"−{tier['g']:.2f} g／RTK", 9.5, color=MUTED, ha="center")
        txt(fig, 0.94, y + 0.005, f"{tier['co2'] / 1000:,.1f} 千噸", 13, color=JADE, ha="right", weight="bold")
    txt(fig, 0.505, 0.214, "可縮小 2030 剩餘差距（%） / Share of gap", 11, color=MUTED, ha="center")
    txt(fig, 0.055, 0.143, f"④ 情景每年潛在燃油節省 HK${tiers[3]['save'] / 1e6:.0f}M；可減 {tiers[3]['g']:.1f} g／RTK。", 12, color=JADE, weight="bold")
    txt(fig, 0.055, 0.095, "① 為合成營運模型；②–④ 為推廣情景。後一級已包含前一級，不能把四列相加。", 10, color=MUTED)
    txt(fig, 0.055, 0.049, "推廣須試點校準；燃油節省未扣新增維修、設備與平台成本。 / Cumulative tiers; pilot validation required.", 9.5, color=MUTED)
    finish(fig, "target-2030.zh-Hant.png", qa)


def main():
    global FONT, FONT_FAMILY
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qa-dir", type=Path)
    parser.add_argument("--font")
    parser.add_argument("--node", default="node", help="Node.js 24 executable")
    args = parser.parse_args()
    FONT = font_path(args.font)
    font_manager.fontManager.addfont(FONT)
    family = font_manager.FontProperties(fname=FONT).get_name()
    FONT_FAMILY = family
    matplotlib.rcParams.update({"font.family": [family, "DejaVu Sans"], "axes.unicode_minus": False, "svg.fonttype": "path"})
    result = subprocess.run([args.node, str(ROOT / "scripts/docs/readme-data.mjs")], check=True, capture_output=True)
    data = json.loads(result.stdout)
    if args.qa_dir:
        args.qa_dir.mkdir(parents=True, exist_ok=True)
        (args.qa_dir / "readme-graphics-data.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (args.qa_dir / "render-environment.json").write_text(json.dumps({"matplotlib": matplotlib.__version__,
            "numpy": np.__version__, "font": FONT, "font_family": family, "width_px": WIDTH}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    banner(data, args.qa_dir)
    cost_curve(data, args.qa_dir)
    rolling_year(data, args.qa_dir)
    carbon_target(data, args.qa_dir)
    print("Regenerated banner, cost-of-waiting, rolling-year and target-2030 PNGs.")


if __name__ == "__main__":
    main()
