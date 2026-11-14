# 数学模型 / Mathematical model

三步得出全机队最划算的计划：① 预测剩余寿命与退化耗油；② 为每项工作画出「等待的代价」曲线；③ 在共享资源限制下，用 0-1 整数规划为整个机队一起求解。

Three steps produce the fleet's cheapest safe plan: (1) predict remaining useful life and fuel deterioration; (2) build a cost-of-waiting curve for each job; (3) solve all jobs together as a binary integer program under shared-resource constraints.

| 环节 / Stage                        | 算法 / Algorithm                                                                              | 实现 / Implementation                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 预测 / Prediction                   | 多层感知器集成（MLP Ensemble，15 个网络）＋分箱交叉共形预测区间（Cross-Conformal Prediction） | [train_rul.py](../experiments/rul-cmapss/train_rul.py)                |
| 单项时机 / Single-job timing        | 五项成本逐日叠加；最佳区间与风险截止 / Five-term cost curve; best window and risk cutoff      | `costCurve` in [joint-model.js](../site/assets/js/joint-model.js)     |
| 机队联合决策 / Fleet joint decision | 0-1 整数规划（Binary Integer Programming），精确分支定界（Branch and Bound）                  | `solveJoint` in [joint-model.js](../site/assets/js/joint-model.js)    |
| 现行做法 / Current practice         | 固定门槛、按告警先后分配备件、性能问题等定检 / Threshold rule, first-come spares              | `solveBaseline` in [joint-model.js](../site/assets/js/joint-model.js) |
| 全年滚动 / Rolling year             | 26 期序贯求解，备件跨期延续 / Sequential solves with carried-over spares                      | [rolling-sim.js](../site/assets/js/rolling-sim.js)                    |

## 求解规模 / Problem size

第 1 期 21 项工作，每项有多个可选方案（停场窗口 × 备件来源，或延至定检）。分支定界先排耦合最强的换件工作，并以「已选成本 + 其余工作的单项下界」剪枝；第 1 期约 3,700 个节点、0.3 秒内证明全局最优。全年 26 期中 23 期完成完整搜索，其余 3 期在 60,000 节点上限内取最佳可行解。

Period 1 has 21 jobs, each with several options (window × spare source, or defer). Branch and bound orders the tightly coupled engine changes first and prunes with "cost so far + per-job lower bounds"; period 1 proves the global optimum in about 3,700 nodes and 0.3 s. In the rolling year, 23 of 26 periods finish the full search; the other 3 return the best feasible plan within a 60,000-node limit.

## 公式 / Formulas

公式与 Demo「模型」页同源（[model_spec.py](../scripts/site/model_spec.py)），说明沿用 Demo 的繁体中文。公式块与符号表采用 GitHub 支持的数学定界语法，避免 Markdown 转义改写 TeX；编号放在公式标题中。Demo 内为预先排版的独立 SVG。 / Formulas share one source with the demo's model page; descriptions keep the demo's Traditional Chinese. GitHub's math fences and protected inline delimiters keep Markdown from altering TeX; equation numbers appear in the headings. The demo ships self-contained SVGs.

### A · 預測：剩餘壽命與退化

**(1) 剩餘使用壽命預測**

```math
\hat{R}_i=\dfrac{1}{M}\sum_{m=1}^{M} g_m\left(\psi(\mathbf{x}_{i,1:t})\right),\qquad M=15
```

15 個多層感知器（5 折 × 3 個隨機種子）的平均。ψ 把 14 個感測器的歷史序列轉成指數平滑值與滾動斜率；訓練目標為 min(R, R̄)。

**(2) 90% 預測區間（交叉共形）**

```math
\left[\hat{R}_i-\hat{q}_b,\ \hat{R}_i+\hat{q}_b\right],\qquad \hat{q}_b=\mathrm{Quantile}_{\lceil (n_b+1)(1-\delta)\rceil/n_b}\Big\{\big|R_j-\hat{R}_j^{(-j)}\big|:\ \hat{R}_j\in b\Big\}
```

以折外殘差按預測值分箱 b 取分位數，δ = 0.10。剩餘壽命越短，區間越窄。

**(3) 換算為天**

```math
\mu_i=\dfrac{\hat{R}_i}{\kappa},\qquad \sigma_i=\dfrac{\hat{q}_b}{z_{0.95}\,\kappa}
```

κ 為每天循環數；以常態分布近似剩餘壽命的不確定性。

**(4) 失效概率**

```math
F_i(s)=\Pr\big(T_i\le s\big)=\Phi\left(\dfrac{s-\mu_i}{\sigma_i}\right),\qquad i\in\mathcal{I}^{R}
```

在第 s 天執行時，部件已失效的概率。性能恢復工作不會導致失效，F_i ≡ 0。

**(5) 退化多耗油**

```math
\Delta B_i(s)=\int_{0}^{s_E} f_i(\tau)\,d\tau+(1-r_i)\int_{s_E}^{E} f_i(\tau)\,d\tau,\qquad f_i(\tau)=f_{i0}+\lambda_i\tau,\quad s_E=\min(s,E)
```

修好前每天多耗油 f_i，修好後只能消除比例 r_i；E 為評估期，s_E 取執行日與評估期末較早者。

### B · 單項成本：五項

**(6) 停飛預期損失**

```math
C^{\mathrm{AOG}}_{io}=F_i(d_o)\left[\left(\pi h^{\mathrm{HKG}}+(1-\pi)\,h^{\mathrm{out}}\right)c^{\mathrm{AOG}}\chi+\mathbf{1}^{\mathrm{eng}}_i\,c^{\mathrm{rec}}\right]
```

失效概率 × 停飛時長 × 每小時損失；外站換發動機另加運送與工作組成本。

**(7) 燃油與碳**

```math
C^{\mathrm{fuel}}_{io}=p_f\,\Delta B_i(d_o),\qquad C^{\mathrm{carb}}_{io}=\eta\,\Delta B_i(d_o)\,p_c\,\chi\,\kappa_c
```

碳成本與燃油共用同一耗油量；碳價為內部影子價格，不是現金支出。

**(8) 提早更換浪費的壽命**

```math
G_{io}=v_i\max\big(0,\mu_i-d_o\big),\qquad V_{io}=\max\Big(0,\ \rho G_{io}-\big(c^{\mathrm{insp}}+c^{\mathrm{lg}}+\tau_x\rho G_{io}\big)\Big),\qquad C^{\mathrm{life}}_{io}=G_{io}-V_{io}
```

G 為未用壽命的價值；拆下零件可回收一部分 V，不劃算時不回收。

**(9) 維修執行**

```math
C^{\mathrm{exec}}_{io}=\sum_{q}\, h_{iq}\,\ell_{k_o q}+c^{\mathrm{spare}}_{m_o}+\mathbf{1}^{\mathrm{MEL}}_i\,c^{\mathrm{MEL}}d_o+\mathbf{1}^{\mathrm{ded}}_o\left(h^{\mathrm{ded}}c^{\mathrm{ded}}\chi+c^{\mathrm{slot}}\right)
```

工時 × 費率，加上備件來源成本（短期租用或調撥）、保留故障每日成本、臨時抽調停場成本。

**(10) 單項總成本**

```math
c_{io}=C^{\mathrm{AOG}}_{io}+C^{\mathrm{fuel}}_{io}+C^{\mathrm{carb}}_{io}+C^{\mathrm{life}}_{io}+C^{\mathrm{exec}}_{io}
```

每個工作 i 的每個選項 o（日期、站點、備件來源）都有一個總成本。

### C · 機隊聯合決策：0-1 整數規劃

**(11) 目標函數**

```math
\min\ Z=\sum_{i\in\mathcal{I}}\ \sum_{o\in\mathcal{O}_i} c_{io}x_{io}+\sum_{a,w}\varphi_{k_w}y_{aw}+\sum_{k,t,q}(\gamma-1)\,\ell_{kq}\,z_{ktq}+c^{\mathrm{ext}}\sum_{a,w}e_{aw}-\sum_{a,w}\beta_{aw}b_{aw}
```

五項成本之和，加上計劃層的機庫費、加班、停場延長，減去同一次停場合併兩項工作省下的工時。

**(12) 每項工作只選一個方案**

```math
\sum_{o\in\mathcal{O}_i} x_{io}=1\qquad \forall i\in\mathcal{I}
```

方案包括可用停場窗口 × 備件來源，以及延至下次定檢。

**(13) 安全上限**

```math
F_i(d_o)\,x_{io}\le P_{\mathrm{max}}\qquad \forall i\in\mathcal{I}^{R},\ o\in\mathcal{O}_i
```

任何換件工作在執行日的失效概率都不能超過上限。

**(14) 保留故障期限**

```math
d_o\,x_{io}\le D_i\qquad \forall i\in\mathcal{I}^{\mathrm{MEL}},\ o\in\mathcal{O}_i
```

最低設備清單允許的延後期限。

**(15) 機庫位**

```math
\sum_{a}\, y_{a\,w(k,t)}+B^{\mathrm{bay}}_{kt}\le \mathrm{Cap}^{\mathrm{bay}}_{k},\qquad y_{aw}\ge x_{io}\quad \forall o\in w,\ i\in\mathcal{I}^{\mathrm{hgr}}
```

需要機庫的工作佔用一個機庫位（A 檢已預留除外）；B 為其他飛機的背景佔用。

**(16) 工程師工時與加班**

```math
\sum_{i,\,o:\ k_o=k,\ d_o=t} h_{iq}x_{io}+B^{q}_{kt}\le \mathrm{Cap}^{q}_{k}+z_{ktq},\qquad 0\le z_{ktq}\le \theta\,\mathrm{Cap}^{q}_{k}
```

每天每站每類執照的工時上限；超出部分按加班計，最多 θ。

**(17) 停場時長**

```math
\sum_{i:\ o\in w} u_i\,x_{io}\le g_w+e_{aw},\qquad 0\le e_{aw}\le e^{\mathrm{max}}
```

同一次停場內的工作總時長不能超過停場時長，最多可延長 e^max 小時。

**(18) 設備**

```math
\sum_{i\in\mathcal{I}^{\mathrm{stand}},\ o:\ k_o=k,\ d_o=t}x_{io}\le \mathrm{Cap}^{\mathrm{stand}}_{k},\qquad \sum_{i\in\mathcal{I}^{\mathrm{wash}},\ o:\ k_o=k,\ d_o=t}x_{io}\le \mathrm{Cap}^{\mathrm{wash}}_{k}
```

發動機架與清洗設備每天的數量上限。

**(19) 備件庫存**

```math
\sum_{i,\,o:\ m_o=\mathrm{stock},\ k_o=k,\ d_o\le t}x_{io}\le S^{0}_{pk}+\sum_{t_0\le t}A_{pk t_0}\qquad \forall p,k,t
```

累計用量不能超過在站庫存加已到貨的返修件；短期租用須在交付期 τ 之後。

**(20) 變數範圍**

```math
x_{io},\,y_{aw},\,b_{aw}\in\{0,1\},\qquad z_{ktq},\,e_{aw}\ge 0
```

以精確分支定界（Branch and Bound）求解，搜尋完成時為全域最優。

### D · 等待的代價與評估

**(21) 參照成本曲線**

```math
C_i(s)=c_i\big(s;\ \mathrm{HKG},\ \mathrm{stock}\big),\qquad s^{*}_i=d_{o^{*}},\quad o^{*}=\underset{o\in\mathcal{O}_i\setminus\{\mathrm{defer}\}}{\mathrm{arg\,min}}\ c_{io}
```

固定香港過夜停場、在站庫存，逐日計算五項成本，得到等待的代價曲線；s* 為成本最低的可行窗口。

**(22) 最佳區間與風險截止**

```math
\mathcal{W}^{\mathrm{econ}}_i=\Big\{s:\ C_i(s)\le(1+\varepsilon)\,C_i(s^{*}_i)\Big\}\cap\Big\{s\le s^{\mathrm{risk}}_i\Big\},\qquad s^{\mathrm{risk}}_i=\mu_i+\sigma_i\,\Phi^{-1}\big(P_{\mathrm{max}}\big)
```

總成本不超過最低值 (1+ε) 倍、且未超過安全上限的日子；臨界區用 ε_w。

**(23) 邊際等待成本**

```math
\dfrac{dC_i}{ds}\approx\dfrac{C_i(s+\Delta s)-C_i(s-\Delta s)}{2\,\Delta s},\qquad \Delta s=0.5
```

在最佳區間末端，每多等一天增加的成本。

**(24) 節省對帳**

```math
\Delta=Z^{B}-Z^{J}=\sum_{\nu}\left(C^{B}_{\nu}-C^{J}_{\nu}\right),\qquad \nu\in\{\mathrm{AOG},\ \mathrm{fuel},\ \mathrm{carb},\ \mathrm{life},\ \mathrm{exec}\}
```

現行做法 B 與聯合決策 J 的五項差額相加，等於總節省；計劃層耦合只計一次。

**(25) 年化**

```math
\Delta^{\mathrm{yr}}=N\,\Delta,\qquad \Delta\mathrm{CO_2}^{\mathrm{yr}}=N\,\eta\big(\Delta B^{B}-\Delta B^{J}\big),\qquad N=26
```

滾動排程每 14 天重排一次，全年 26 期；假設每期工作量相近。

## 符号与参数表 / Symbols and parameters

每一个公式中出现的符号都列于此。「预设值」为 Demo 的默认参数（[params-default.json](../data/samples/demo/params-default.json)），可在 Demo「模型」页直接修改并重算。 / Every symbol used above is listed. Defaults match the demo and can be edited live on its model page.

### 集合與下標

| 符號 / Symbol                                                                                                            | 含義 / Meaning                                   | 預設值 / Default       | 單位 / Unit | 依據 / Basis                           |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------- | ----------- | -------------------------------------- |
| $`i\in\mathcal{I}=\mathcal{I}^{R}\cup\mathcal{I}^{P}`$                                                                   | 維修工作（可靠性／性能恢復）                     | 21 項                  | —           | 本期工作清單                           |
| $`\mathcal{I}^{\mathrm{MEL}},\,\mathcal{I}^{\mathrm{hgr}},\,\mathcal{I}^{\mathrm{stand}},\,\mathcal{I}^{\mathrm{wash}}`$ | 保留故障、需機庫、需發動機架、需清洗設備的工作   | —                      | —           | 工作屬性                               |
| $`a,\ a(i)`$                                                                                                             | 飛機；工作 i 所屬飛機                            | 20 架                  | —           | 本期有工作的飛機                       |
| $`o\in\mathcal{O}_i`$                                                                                                    | 工作 i 的可選方案（窗口 × 備件來源，或延至定檢） | —                      | —           | 由停場窗口與備件池生成                 |
| $`w,\ g_w,\ k_w`$                                                                                                        | 停場窗口；窗口時長；窗口所在站點                 | —                      | 小時        | 航班計劃中的過夜、輪休、A 檢           |
| $`d_o,\ k_o,\ m_o`$                                                                                                      | 方案的執行日、站點、備件來源                     | —                      | 天          | 備件來源：在站庫存／跨站調撥／短期租用 |
| $`k\in\mathcal{K}`$                                                                                                      | 站點                                             | 香港、曼谷、新加坡     | —           | —                                      |
| $`t,\ H`$                                                                                                                | 日；排程視窗                                     | 14                     | 天          | 每 14 天重排一次                       |
| $`q`$                                                                                                                    | 工程師執照類別                                   | B1（機械）、B2（航電） | —           | 香港民航處持證類別                     |
| $`p`$                                                                                                                    | 備件池                                           | 備用發動機、起動發電機 | —           | —                                      |
| $`s`$                                                                                                                    | 候選執行日（連續）                               | —                      | 天          | 用於等待的代價曲線                     |

### 決策變數

| 符號 / Symbol | 含義 / Meaning                 | 預設值 / Default | 單位 / Unit | 依據 / Basis           |
| ------------- | ------------------------------ | ---------------- | ----------- | ---------------------- |
| $`x_{io}`$    | 工作 i 是否選方案 o            | 0／1             | —           | —                      |
| $`y_{aw}`$    | 飛機 a 在窗口 w 是否佔用機庫位 | 0／1             | —           | —                      |
| $`b_{aw}`$    | 同一停場是否合併兩項工作       | 0／1             | —           | 例：換發動機時順便清洗 |
| $`z_{ktq}`$   | 加班工時                       | ≥ 0              | 小時        | —                      |
| $`e_{aw}`$    | 停場延長時數                   | ≥ 0              | 小時        | —                      |

### 預測

| 符號 / Symbol                | 含義 / Meaning                                               | 預設值 / Default | 單位 / Unit     | 依據 / Basis                                   |
| ---------------------------- | ------------------------------------------------------------ | ---------------- | --------------- | ---------------------------------------------- |
| $`\hat{R}_i`$                | 剩餘壽命預測（中位數）                                       | 見任務表         | 循環            | 多層感知器集成輸出                             |
| $`M,\ g_m`$                  | 集成網絡數量；第 m 個網絡                                    | 15               | —               | 5 折 × 3 個隨機種子；兩層隱藏層 128／64、ReLU  |
| $`\psi(\cdot)`$              | 特徵：指數平滑（α = 0.03、0.08、0.20）與 20／60 循環滾動斜率 | 71 維            | —               | 14 個感測器                                    |
| $`\bar{R}`$                  | 訓練目標上限                                                 | 125              | 循環            | 分段線性目標，與文獻一致                       |
| $`\hat{q}_b,\ n_b,\ \delta`$ | 分箱共形分位數；箱內樣本數；未覆蓋率                         | δ = 0.10         | 循環            | 剩餘 30 循環以內 ±5.8                          |
| $`\mathbf{x}_{i,1:t}`$       | 部件 i 至今的感測器歷史序列                                  | 14 個感測器      | —               | 溫度、壓力、轉速、燃油流量等                   |
| $`R_j,\ \hat{R}_j^{(-j)}`$   | 訓練樣本的實際剩餘壽命；不含該樣本的折外預測                 | —                | 循環            | 用於校準預測區間                               |
| $`T_i`$                      | 部件 i 的失效時間（隨機變數）                                | —                | 天              | —                                              |
| $`\tau`$                     | 積分變數（評估期內的日子）                                   | —                | 天              | —                                              |
| $`\kappa`$                   | 每天循環數                                                   | 1.5              | 循環／天        | 777-300ER 長途航線                             |
| $`z_{0.95}`$                 | 標準常態 95% 分位數                                          | 1.645            | —               | —                                              |
| $`\mu_i,\ \sigma_i`$         | 剩餘壽命的平均值與標準差                                     | 見任務表         | 天              | —                                              |
| $`F_i(s),\ \Phi`$            | 失效概率；標準常態累積分布                                   | —                | —               | —                                              |
| $`f_{i0},\ \lambda_i`$       | 目前每天多耗油；每天增長                                     | 見任務表         | 噸／天、噸／天² | 文獻：清洗可降 0.5–1.5%；引氣每多 1% 增耗 1–2% |
| $`r_i`$                      | 修復後可消除的多耗油比例                                     | 見任務表         | —               | 清洗 60%，漏氣與密封 90%                       |
| $`E`$                        | 評估期                                                       | 60               | 天              | 覆蓋一個 A 檢週期                              |
| $`s_E`$                      | 積分上限：min(s, E)                                          | —                | 天              | 修好之日與評估期末取較早者                     |
| $`\Delta B_i(s)`$            | 評估期內退化多耗油                                           | —                | 噸              | —                                              |

### 成本

| 符號 / Symbol                                                                               | 含義 / Meaning                             | 預設值 / Default     | 單位 / Unit  | 依據 / Basis                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------- | ------------ | ------------------------------------ |
| $`c^{\mathrm{AOG}}`$                                                                        | 停飛每小時損失                             | 40,000               | US\$／小時   | Boeing 估算 US\$1–15 萬              |
| $`h^{\mathrm{HKG}}`$                                                                        | 停飛時長（香港，備件在站）                 | 24                   | 小時         | GE90 換發參考 48 小時                |
| $`h^{\mathrm{out}}`$                                                                        | 停飛時長（外站）                           | 72                   | 小時         | 需運送備發與工作組                   |
| $`\pi`$                                                                                     | 失效發生在香港的概率                       | 0.55                 | —            | 按基地停留時間比例                   |
| $`c^{\mathrm{rec}}`$                                                                        | 外站換發動機的運送與工作組成本             | 1,200,000            | HK\$         | 假設                                 |
| $`\mathbf{1}^{\mathrm{eng}}_i,\ \mathbf{1}^{\mathrm{MEL}}_i,\ \mathbf{1}^{\mathrm{ded}}_o`$ | 指示函數：換發動機、保留故障、臨時抽調停場 | 0／1                 | —            | —                                    |
| $`\chi`$                                                                                    | 匯率                                       | 7.8                  | HK\$／US\$   | 聯繫匯率                             |
| $`p_f`$                                                                                     | 航油價格                                   | 5,900                | HK\$／噸     | 國泰 2025 年燃油成本 ÷ 推算用量      |
| $`\eta`$                                                                                    | 每噸燃油排放 CO₂                           | 3.16                 | 噸 CO₂／噸   | 國際民航組織（ICAO）方法             |
| $`p_c`$                                                                                     | 內部碳價                                   | 30                   | US\$／噸 CO₂ | 國際航空碳抵銷機制（CORSIA）價格預測 |
| $`\kappa_c`$                                                                                | 碳價覆蓋比例                               | 1                    | —            | 影子碳價取 100%                      |
| $`v_i`$                                                                                     | 剩餘壽命每天價值                           | HK\$51,000（發動機） | HK\$／天     | 整機價值 ÷ 在翼壽命 × 50%            |
| $`G_{io},\ V_{io}`$                                                                         | 未用壽命價值；可回收淨值                   | —                    | HK\$         | —                                    |
| $`\rho`$                                                                                    | 拆下零件可回收比例                         | 0.4                  | —            | 示例值                               |
| $`c^{\mathrm{insp}}`$                                                                       | 回收：拆卸與檢測                           | 60,000               | HK\$         | 孔探與記錄審查                       |
| $`c^{\mathrm{lg}}`$                                                                         | 回收：物流                                 | 30,000               | HK\$         | 示例值                               |
| $`\tau_x`$                                                                                  | 回收：交易成本比例                         | 0.02                 | —            | 經紀與文件費                         |
| $`h_{iq},\ u_i`$                                                                            | 工作 i 所需工時；停場時長                  | 見任務表             | 小時         | —                                    |
| $`\ell_{kq}`$                                                                               | 工時費率（香港 B1）                        | 610                  | HK\$／小時   | 技師工資 + 30% 附加                  |
| $`\ell_{kq}`$                                                                               | 工時費率（香港 B2）                        | 680                  | HK\$／小時   | —                                    |
| $`c^{\mathrm{spare}}_{m}`$                                                                  | 備件來源成本：短期租用（備用發動機）       | 2,300,000            | HK\$         | 按 1 個月起租 + 運輸                 |
| $`c^{\mathrm{spare}}_{m}`$                                                                  | 備件來源成本：跨站調撥（起動發電機）       | 15,000               | HK\$         | —                                    |
| $`c^{\mathrm{MEL}},\ D_i`$                                                                  | 保留故障每日成本；期限                     | 25,000               | HK\$／天     | 期限 10 天                           |
| $`h^{\mathrm{ded}}`$                                                                        | 臨時抽調停場時長                           | 48                   | 小時         | —                                    |
| $`c^{\mathrm{ded}}`$                                                                        | 臨時抽調停場每小時                         | 10,000               | US\$／小時   | 有預告的計劃停場                     |
| $`c^{\mathrm{slot}}`$                                                                       | 臨時抽調停場固定成本                       | 150,000              | HK\$         | —                                    |
| $`c_{io}`$                                                                                  | 工作 i 選方案 o 的單項總成本               | —                    | HK\$         | 公式 (10)                            |

### 計劃層

| 符號 / Symbol                          | 含義 / Meaning             | 預設值 / Default | 單位 / Unit | 依據 / Basis         |
| -------------------------------------- | -------------------------- | ---------------- | ----------- | -------------------- |
| $`\varphi_{k}`$                        | 機庫費（香港）             | 30,000           | HK\$／次    | —                    |
| $`\gamma`$                             | 加班倍數                   | 1.5              | ×           | 香港常見 1.5 倍      |
| $`\theta`$                             | 加班擴容上限               | 0.25             | —           | —                    |
| $`c^{\mathrm{ext}}`$                   | 停場延長每小時成本         | 78,000           | HK\$／小時  | 取停飛成本區間下限   |
| $`e^{\mathrm{max}}`$                   | 停場最多延長               | 6                | 小時        | —                    |
| $`\beta_{aw}`$                         | 合併兩項工作省下的工時成本 | 4 小時 × B1 費率 | HK\$        | 換發動機時順便清洗   |
| $`w(k,t)`$                             | 站點 k 第 t 天的停場窗口   | —                | —           | —                    |
| $`P_{\mathrm{max}}`$                   | 失效概率安全上限           | 0.08             | —           | 工程安全約束         |
| $`\mathrm{Cap}^{\mathrm{bay}}_{k}`$    | 香港可用機庫位             | 2                | 個          | —                    |
| $`\mathrm{Cap}^{q}_{k}`$               | 香港 B1 每日工時           | 600              | 小時        | 約 75 名 B1 × 8 小時 |
| $`\mathrm{Cap}^{q}_{k}`$               | 香港 B2 每日工時           | 150              | 小時        | —                    |
| $`\mathrm{Cap}^{\mathrm{stand}}_{k}`$  | 香港發動機架               | 1                | 套          | —                    |
| $`\mathrm{Cap}^{\mathrm{wash}}_{k}`$   | 香港清洗設備               | 2                | 套          | —                    |
| $`B^{\mathrm{bay}}_{kt},\ B^{q}_{kt}`$ | 其他飛機的背景佔用         | 見資源表         | 個、小時    | —                    |
| $`S^{0}_{pk}`$                         | 香港在站備用發動機         | 1                | 台          | —                    |
| $`A_{pk t_0}`$                         | 第 t₀ 天到貨的返修件數     | 1                | 件          | —                    |
| $`t_0`$                                | 返修到貨日                 | 9                | 第 n 天     | —                    |
| $`\tau^{\mathrm{lease}}`$              | 短期租用交付期             | 5                | 天          | —                    |

### 評估

| 符號 / Symbol                                                                              | 含義 / Meaning                                       | 預設值 / Default | 單位 / Unit | 依據 / Basis               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------- | ----------- | -------------------------- |
| $`\varepsilon`$                                                                            | 最佳區間容忍度                                       | 0.05             | —           | —                          |
| $`\varepsilon_w`$                                                                          | 臨界區容忍度                                         | 0.15             | —           | —                          |
| $`C_i(s),\ s^{*}_i,\ s^{\mathrm{risk}}_i`$                                                 | 參照成本曲線；最低成本窗口；風險截止日               | —                | HK\$、天    | —                          |
| $`Z^{B},\ Z^{J},\ \Delta`$                                                                 | 現行做法、聯合決策的總成本；節省                     | —                | HK\$        | —                          |
| $`\mathrm{HKG},\ \mathrm{stock},\ \mathrm{defer}`$                                         | 參照條件：香港過夜停場、在站庫存；延至下次定檢的方案 | —                | —           | —                          |
| $`o^{*},\ \mathcal{W}^{\mathrm{econ}}_i,\ \Phi^{-1}`$                                      | 成本最低的方案；最佳區間；標準常態反函數             | —                | —           | —                          |
| $`\Delta s`$                                                                               | 數值差分步長                                         | 0.5              | 天          | —                          |
| $`\nu,\ C^{B}_{\nu},\ C^{J}_{\nu}`$                                                        | 成本項目；現行做法與聯合決策的該項成本               | 5 項             | HK\$        | 停飛、燃油、碳、壽命、執行 |
| $`\Delta^{\mathrm{yr}},\ \Delta\mathrm{CO_2}^{\mathrm{yr}},\ \Delta B^{B},\ \Delta B^{J}`$ | 全年節省；全年減碳；兩種做法的退化多耗油             | —                | HK\$、噸    | —                          |
| $`N`$                                                                                      | 每年排程期數                                         | 26               | 期          | 365 ÷ 14                   |
