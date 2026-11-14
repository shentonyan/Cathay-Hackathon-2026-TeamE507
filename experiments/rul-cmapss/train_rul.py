"""Remaining-useful-life model for NASA C-MAPSS FD001.

剩余使用寿命预测：多层感知器集成 + 分箱交叉共形区间。
Remaining useful life: MLP ensemble + binned cross-conformal intervals.

Pure NumPy/pandas implementation so the result can be reproduced without a GPU
or a deep-learning framework. Deterministic given the fixed seeds below.

Usage:
    python download_data.py          # fetch + verify FD001 files into data/raw/cmapss
    python train_rul.py              # train, evaluate, write outputs/ and results/

Outputs (written next to this file):
    outputs/predictions_test.csv     per-unit prediction, interval and truth
    results/model_card.json          metrics used by the demo
    results/demo_engines.json        three engines shown in the demo
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DATA = ROOT / "data" / "raw" / "cmapss"

COLS = ["unit", "cyc", "os1", "os2", "os3"] + [f"s{i}" for i in range(1, 22)]
# 14 informative sensors; the 7 constant sensors of FD001 are dropped.
SENSORS = ["s2", "s3", "s4", "s7", "s8", "s9", "s11", "s12", "s13", "s14", "s15", "s17", "s20", "s21"]
CAP = 125  # piecewise-linear RUL target cap (literature standard)
EWM_ALPHAS = (0.03, 0.08, 0.2)
SLOPE_WINDOWS = (20, 60)
FOLDS, FOLD_SEED = 5, 0
NET_SEEDS = (5, 6, 7)  # 3 networks per fold -> 15 networks
EPOCHS, HIDDEN, LR, WEIGHT_DECAY, BATCH, DROPOUT = 40, (128, 64), 1e-3, 3e-4, 256, 0.15
BINS = ((0, 30), (30, 60), (60, 90), (90, 126))
DELTA = 0.10  # 90 % nominal coverage
DEMO_ENGINES = (("DEMO-07", 64, "2 號發動機 高壓壓氣機性能退化"),
                ("DEMO-04", 49, "1 號發動機 高壓壓氣機性能退化"),
                ("DEMO-13", 36, "2 號發動機 高壓壓氣機性能退化"))
CYCLES_PER_DAY = 1.5      # 777-300ER long-haul assumption
FUEL_T_PER_ENGINE_DAY = 39.6


def load(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA / name, sep=r"\s+", header=None, names=COLS)


def features(df: pd.DataFrame, mu: pd.Series, sd: pd.Series) -> pd.DataFrame:
    """Exponential smoothing + rolling least-squares slopes per sensor (71 columns)."""
    out = []
    for unit, g in df.groupby("unit"):
        z = (g[SENSORS] - mu) / sd
        f = {}
        for a in EWM_ALPHAS:
            e = z.ewm(alpha=a, adjust=True).mean()
            f.update({f"e{a}_{c}": e[c] for c in SENSORS})
        t = pd.Series(np.arange(len(z)), index=z.index, dtype=float)
        for w in SLOPE_WINDOWS:
            mean = z.rolling(w, min_periods=3).mean()
            cov = z.mul(t, axis=0).rolling(w, min_periods=3).mean() - mean.mul(t.rolling(w, min_periods=3).mean(), axis=0)
            slope = cov.div(t.rolling(w, min_periods=3).var(ddof=0), axis=0).fillna(0)
            f.update({f"sl{w}_{c}": slope[c] for c in SENSORS})
        h = pd.DataFrame(f, index=z.index).fillna(0)
        h["cyc"] = g.cyc.values / 200
        h["unit"], h["n"], h["c"] = unit, len(g), g.cyc.values
        out.append(h)
    return pd.concat(out)


def mlp_train(X, y, seed, ep=EPOCHS, h=HIDDEN, lr=LR, wd=WEIGHT_DECAY, bs=BATCH, drop=DROPOUT):
    """Two hidden ReLU layers, dropout, Adam, cosine learning-rate schedule, MSE loss."""
    rng = np.random.default_rng(seed)
    d, (h1, h2) = X.shape[1], h
    params = [rng.normal(0, np.sqrt(2 / d), (d, h1)), np.zeros(h1),
              rng.normal(0, np.sqrt(2 / h1), (h1, h2)), np.zeros(h2),
              rng.normal(0, np.sqrt(1 / h2), (h2, 1)), np.array([60.0])]
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    step, n = 0, len(X)
    for e in range(ep):
        idx = rng.permutation(n)
        lr_e = lr * 0.5 * (1 + np.cos(np.pi * e / ep))
        for s in range(0, n, bs):
            j = idx[s:s + bs]
            x, yy = X[j], y[j]
            W1, b1, W2, b2, W3, b3 = params
            z1 = x @ W1 + b1
            a1 = np.maximum(z1, 0)
            mask = (rng.random(a1.shape) > drop) / (1 - drop)
            a1d = a1 * mask
            z2 = a1d @ W2 + b2
            a2 = np.maximum(z2, 0)
            out = (a2 @ W3 + b3).ravel()
            g = (out - yy)[:, None] * 2 / len(j)
            gW3, gb3 = a2.T @ g, g.sum(0)
            ga2 = g @ W3.T * (z2 > 0)
            gW2, gb2 = a1d.T @ ga2, ga2.sum(0)
            ga1 = ga2 @ W2.T * mask * (z1 > 0)
            gW1, gb1 = x.T @ ga1, ga1.sum(0)
            grads = [gW1 + wd * W1, gb1, gW2 + wd * W2, gb2, gW3 + wd * W3, gb3]
            step += 1
            for i, (p, gr) in enumerate(zip(params, grads)):
                m[i] = 0.9 * m[i] + 0.1 * gr
                v[i] = 0.999 * v[i] + 0.001 * gr * gr
                p -= lr_e * (m[i] / (1 - 0.9 ** step)) / (np.sqrt(v[i] / (1 - 0.999 ** step)) + 1e-8)
    return params


def mlp_predict(params, X):
    W1, b1, W2, b2, W3, b3 = params
    return np.clip((np.maximum(np.maximum(X @ W1 + b1, 0) @ W2 + b2, 0) @ W3 + b3).ravel(), 0, CAP)


def nasa_score(d):
    """PHM08 asymmetric score; late predictions (d > 0) are penalised more."""
    return float(np.sum(np.where(d < 0, np.exp(-d / 13) - 1, np.exp(d / 10) - 1)))


def main(quick: bool = False) -> dict:
    t0 = time.time()
    tr, te = load("train_FD001.txt"), load("test_FD001.txt")
    rul = pd.read_csv(DATA / "RUL_FD001.txt", sep=r"\s+", header=None).values.ravel()
    mu, sd = tr[SENSORS].mean(), tr[SENSORS].std()
    ftr, fte = features(tr, mu, sd), features(te, mu, sd)
    cols = [c for c in ftr.columns if c not in ("unit", "n", "c")]
    Xtr, Xte = ftr[cols].values, fte[cols].values
    y = np.minimum(CAP, (ftr.n - ftr.c).values).astype(float)
    units = ftr.unit.values
    fm, fs = Xtr.mean(0), Xtr.std(0) + 1e-6
    A, B = (Xtr - fm) / fs, (Xte - fm) / fs
    last = np.array([np.where(fte.unit.values == u)[0][-1] for u in sorted(te.unit.unique())])

    folds = np.array_split(np.random.default_rng(FOLD_SEED).permutation(np.unique(units)), FOLDS)
    seeds = NET_SEEDS[:1] if quick else NET_SEEDS
    oof, preds = np.zeros(len(A)), []
    for k, fold_units in enumerate(folds):
        va = np.isin(units, fold_units)
        for s in seeds:
            p = mlp_train(A[~va], y[~va], seed=s + 10 * k)
            oof[va] += mlp_predict(p, A[va]) / len(seeds)
            preds.append(mlp_predict(p, B))
        print(f"fold {k + 1}/{FOLDS}  oof RMSE {np.sqrt(np.mean((oof[va] - y[va]) ** 2)):.2f}  ({time.time() - t0:.0f}s)")
    P = np.mean(preds, 0)
    pt, yt = P[last], np.minimum(rul, CAP)

    # cross-conformal half-widths per predicted-RUL bin
    res = np.abs(oof - y)
    half = {}
    for lo, hi in BINS:
        msk = (oof >= lo) & (oof < hi)
        n = msk.sum()
        half[(lo, hi)] = float(np.quantile(res[msk], min(1, np.ceil((n + 1) * (1 - DELTA)) / n)))

    def hw(p):
        for (lo, hi), q in half.items():
            if lo <= p < hi:
                return q
        return list(half.values())[-1]

    H = np.array([hw(p) for p in pt])
    near = yt < 30
    card = {
        "dataset": "NASA C-MAPSS FD001（模擬數據，100 台訓練、100 台測試）",
        "algorithm": "MLP ensemble (15 = 5 folds x 3 seeds) + binned cross-conformal 90% intervals",
        "features": f"{len(cols)} = EWM alpha {list(EWM_ALPHAS)} x 14 sensors + slopes {list(SLOPE_WINDOWS)} x 14 + cycle",
        "test_rmse_cycles": round(float(np.sqrt(np.mean((pt - yt) ** 2))), 2),
        "nasa_score": int(round(nasa_score(pt - yt))),
        "picp_90": round(float(np.mean(np.abs(pt - yt) <= H)) * 100, 1),
        "picp_90_near_failure": round(float(np.mean((np.abs(pt - yt) <= H)[near])) * 100, 1),
        "n_near_failure": int(near.sum()),
        "mean_width_cycles": round(float(2 * H.mean()), 1),
        "cv_rmse": round(float(np.sqrt(np.mean((oof - y) ** 2))), 2),
        "halfwidth_by_bin": {f"{lo}-{min(hi - 1, CAP)}": round(q, 1) for (lo, hi), q in half.items()},
    }
    engines = []
    for reg, u, name in DEMO_ENGINES:
        idx = np.where(fte.unit.values == u)[0]
        p_hist = P[idx]
        g = te[te.unit == u]
        wf = (g.s12 * g.s11).values
        drift = pd.Series((wf / wf[:20].mean() - 1) * 100).ewm(alpha=0.1).mean().values
        slope = float(np.polyfit(np.arange(30), drift[-30:], 1)[0])
        p, h = float(p_hist[-1]), hw(float(p_hist[-1]))
        engines.append({"reg": reg, "type": "777-300ER", "comp": name, "unit": u,
                        "rul_cycles": round(p, 1), "pi90": [round(max(0, p - h), 1), round(p + h, 1)],
                        "true_rul_cycles": int(rul[u - 1]), "mu": round(p / CYCLES_PER_DAY, 2),
                        "sig": round(h / 1.645 / CYCLES_PER_DAY, 2),
                        "f0": round(max(0.0, float(drift[-1])) * FUEL_T_PER_ENGINE_DAY / 100, 3),
                        "k": round(max(0.0, slope) * CYCLES_PER_DAY * FUEL_T_PER_ENGINE_DAY / 100, 4),
                        "wf_drift_pct": round(float(drift[-1]), 2)})

    (HERE / "outputs").mkdir(exist_ok=True)
    (HERE / "results").mkdir(exist_ok=True)
    pd.DataFrame({"unit": np.arange(1, 101), "true_rul": rul, "true_rul_capped": yt, "pred": pt.round(2),
                  "lo90": np.maximum(0, pt - H).round(2), "hi90": (pt + H).round(2)}).to_csv(
        HERE / "outputs" / "predictions_test.csv", index=False)
    if not quick:
        (HERE / "results" / "model_card.json").write_text(json.dumps(card, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (HERE / "results" / "demo_engines.json").write_text(json.dumps(engines, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(card, ensure_ascii=False, indent=2))
    print(f"done in {time.time() - t0:.0f}s")
    return {"card": card, "engines": engines}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quick", action="store_true", help="1 network per fold (smoke test, ~1/3 runtime); does not overwrite results/")
    main(ap.parse_args().quick)
