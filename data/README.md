# 数据管理 / Data management

| 目录 / Directory                 | 规则 / Rule                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| `samples/`                       | 可提交的合成或授权样例 / Commit synthetic or authorized samples |
| `raw/`, `private/`, `processed/` | 本地使用且已忽略 / Local-only, ignored by Git                   |

样例说明字段、单位、来源和生成方式。未确认授权的赛事资料、个人资料与签署文件保留在仓库外。逐项来源见 [数据来源 / Data provenance](../docs/DATA.md)。 / Document fields, units, provenance and generation steps. Keep unauthorized event materials, personal records and signed documents outside the repository. See the data provenance document.

NASA C-MAPSS 原始文件由 [download_data.py](../experiments/rul-cmapss/download_data.py) 下载到 `raw/cmapss/`，以 SHA-256 校验，不提交。 / Raw C-MAPSS files are downloaded into `raw/cmapss/`, checksum-verified and not committed.
