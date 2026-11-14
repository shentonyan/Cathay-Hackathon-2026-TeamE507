"""Download and verify NASA C-MAPSS FD001.

下载并校验 NASA C-MAPSS FD001（公有领域模拟数据）。
Download and verify NASA C-MAPSS FD001 (public-domain simulation data).

Official source / 官方来源: NASA Prognostics Center of Excellence Data Set Repository,
"Turbofan Engine Degradation Simulation Data Set" (Saxena & Goebel, 2008).
The files below are byte-identical copies used to produce results/ in this repo;
SHA-256 checksums make any other mirror verifiable.

Usage:
    python download_data.py            # download from mirror, verify checksums
    python download_data.py --verify   # only verify files already in data/raw/cmapss
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "data" / "raw" / "cmapss"
MIRROR = "https://raw.githubusercontent.com/schwxd/LSTM-Keras-CMAPSS/master/C-MAPSS-Data/"
FILES = {
    "train_FD001.txt": ("963b5e22825b34d8b21c69e1aeb4af3e647050eb672ee8834ba4b5d91d2de0f8", 3515356),
    "test_FD001.txt": ("3cda7109ce17bafb5443f2ac926cfcf88154b941b8c4cf95eb55d1ddd6f52851", 2228855),
    "RUL_FD001.txt": ("a19c8ec94931949d0485bdc35118206e9c81c4547b422efb9cf86f4ceddbceca", 429),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(verify_only: bool) -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    ok = True
    for name, (digest, nbytes) in FILES.items():
        path = DEST / name
        if not path.exists() and not verify_only:
            print(f"downloading {name} ...")
            urllib.request.urlretrieve(MIRROR + name, path)
        if not path.exists():
            print(f"MISSING  {name}  (place the official file at {path})")
            ok = False
            continue
        actual = sha256(path)
        status = "OK" if actual == digest else "MISMATCH"
        ok &= actual == digest
        print(f"{status:8} {name}  {path.stat().st_size:>9} bytes  sha256={actual[:16]}…")
    if not ok:
        print("Checksum verification failed. / 校验失败。", file=sys.stderr)
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--verify", action="store_true")
    sys.exit(main(ap.parse_args().verify))
