# README 圖像重建 / Rebuild README graphics

四張 PNG 以繁體中文為主，附簡短英文；寬度固定 1500 px。資料由完整的瀏覽器應用程式計算邏輯讀出，不手抄曲線或改寫碳情景假設。

The four PNGs are Chinese-first, with short English labels and a width of 1500 px. Their data comes from the shipped application's calculations.

## 執行 / Run

繪圖工具需要 Python 3.12+（固定版本的 NumPy 要求）與儲存庫指定的 Node.js 24。先以專案明確指定的 Python 解譯器安裝本資料夾的 `requirements.txt`，並完成儲存庫根目錄的 `npm ci`。以下的 `<project-python>` 應換成該解譯器的完整路徑。

The plotting tools require Python 3.12+ and Node.js 24. Use the project's explicit Python interpreter and install the development-only requirements. Run these commands from the repository root:

```text
<project-python> -m pip install -r scripts/docs/requirements.txt
<project-python> scripts/docs/build_readme_assets.py --qa-dir outputs/readme-graphics
```

可用 `--font <font-file>` 指定中文字型。預設優先使用 Windows 的 Microsoft JhengHei；其他系統可安裝 Noto Sans CJK TC 或 Noto Sans TC。DejaVu Sans 補齊 CO₂ 下標與數學減號等字形。字型檔不會複製進儲存庫。

Use `--font` to choose a CJK font file. Microsoft JhengHei and Noto Sans CJK TC are supported; DejaVu Sans supplies a few supplementary symbols. Font files are not redistributed.

## 資料與範圍 / Data and scope

| 圖片 / Figure                 | 直接來源 / Source                   | 範圍 / Scope                                                                                       |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `banner.zh-Hant.png`          | `__app.carbonTiers().L[3]`          | 集團推廣、2% 耗油改善、100% 落實；須試點驗證，並非已實現收益。 / Group roll-out scenario.          |
| `cost-of-waiting.zh-Hant.png` | `__app.curveOf(__app.byId('R1'))`   | 相同參照條件下的全部原始曲線點；聯合排程日與風險上限取自同一模型。 / Original R1 curve points.     |
| `rolling-year.zh-Hant.png`    | `__app.rollFor()`、`__app.annual()` | 基準情景的 26 期、484 項合成工作；雙座標軸分別顯示每期與累計節省。 / Base rolling-year simulation. |
| `target-2030.zh-Hant.png`     | `__app.carbonTiers()`               | 四個累積級別各自由零起畫；後一級包含前一級，不能相加。 / Cumulative tiers, not additive.           |

`readme-data.mjs` 透過 [引擎載入器](../site/engine.mjs) 載入實際模型，再在最小 UI 環境中執行完整的 `app.js`。它使用空白的記憶體儲存，不讀取使用者瀏覽器帳戶或執行網路操作；只在瀏覽器事件綁定開始時中止 UI 初始化。

The collector executes the complete app with an empty UI and in-memory storage. It does not parse out individual functions, read browser accounts or make network requests.

`--qa-dir` 另存資料 JSON、來源檔 SHA-256、繪圖環境、PNG 預覽與向量 SVG。這些是開發用工具及依賴，Demo 本身不載入 Matplotlib、NumPy 或 Pillow。

The QA directory receives the data, source hashes, render environment, PNG previews and vector SVGs. Plotting packages are development dependencies only.

## 數字孿生圖片 / Twin captures

另外三張 `twin-*.zh-Hant.png` 是實際 WebGL 畫面的截圖，附中英標題與合成資料說明。管理員選取 `DEMO-07`，依次查看整機、2 號發動機分解，以及高壓壓氣機葉片對比。截圖保留正常件、本機問題件與缺陷位置標籤；內部構造為示意。

The three twin PNGs are live-renderer captures of DEMO-07, its No. 2 engine and the high-pressure compressor blade comparison, with bilingual headings. They retain the app's normal/defective-part labels and damage marker; internal structures are illustrative.
