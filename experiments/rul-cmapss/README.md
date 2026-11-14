# 剩余使用寿命模型 / Remaining-useful-life model

| 项目 / Item        | 内容 / Value                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 假设 / Hypothesis  | 平滑后的感测器趋势足以预测剩余寿命，并能给出校准的 90% 区间 / Smoothed sensor trends predict RUL with calibrated 90% intervals |
| 输入 / Input       | NASA C-MAPSS FD001，公有领域模拟数据，SHA-256 校验 / public-domain, checksum-verified                                          |
| 算法 / Algorithm   | 多层感知器集成：5 折 × 3 种子 = 15 个网络，两层 128/64 ReLU，Dropout 0.15，Adam，余弦学习率，40 轮 / MLP ensemble              |
| 特征 / Features    | 14 个感测器的指数平滑（α = 0.03、0.08、0.20）＋20 与 60 循环滚动斜率＋循环数，共 71 维 / 71 features                           |
| 目标 / Target      | 分段线性剩余寿命，上限 125 循环 / piecewise-linear RUL capped at 125                                                           |
| 区间 / Intervals   | 折外残差按预测值分 4 箱，取有限样本修正的 90% 分位数 / binned cross-conformal                                                  |
| 环境 / Environment | Python 3.11+、NumPy、pandas；不需要 GPU / no GPU                                                                               |
| 耗时 / Runtime     | 约 1–3 分钟 / about 1–3 minutes                                                                                                |

## 复现 / Reproduce

```sh
python -m pip install -r experiments/rul-cmapss/requirements.txt
python experiments/rul-cmapss/download_data.py
python experiments/rul-cmapss/train_rul.py          # --quick 只训练 1/3 网络做冒烟测试 / smoke test
```

## 结果 / Results

下列指标以截断至 125 循环的测试集真实剩余寿命计算。 / The following metrics score test-set ground-truth RUL capped at 125 cycles.

| 指标 / Metric                             | 值 / Value               |
| ----------------------------------------- | ------------------------ |
| 测试 RMSE / Test RMSE                     | 10.65 cycles             |
| NASA 评分 / Score                         | 200                      |
| 90% 区间覆盖 / Coverage                   | 88.0%                    |
| 剩余 <30 循环覆盖 / Near-failure coverage | 92.0%（25 台 / engines） |
| 平均宽度 / Mean width                     | 27.8 cycles              |
| 交叉验证 RMSE / CV RMSE                   | 9.39 cycles              |

| 文件 / File                                            | 内容 / Contents                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [results/model_card.json](results/model_card.json)     | 上表指标与分箱半宽 / Metrics and bin half-widths                   |
| [results/demo_engines.json](results/demo_engines.json) | Demo 使用的三台发动机 / The three demo engines                     |
| `outputs/predictions_test.csv`                         | 100 台测试发动机逐台预测（忽略）/ Per-engine predictions (ignored) |

## 与公开研究比较 / Literature comparison

文献数字仅供参考；尚未核对各研究的目标截断、预处理与评分流程，不能视为相同评估条件下的直接比较。 / Literature figures provide context; target capping, preprocessing and scoring protocols have not been matched, so these are not direct comparisons under the same evaluation conditions.

| 方法 / Method                                 |  RMSE | NASA 评分 / Score |
| --------------------------------------------- | ----: | ----------------: |
| 本实验：MLP 集成 + 交叉共形 / This experiment | 10.65 |               200 |
| DCNN（Li, Ding & Sun, 2018）                  | 12.61 |               274 |
| LSTM（Zheng et al., 2017）                    | 16.14 |               338 |
| CNN（Babu, Zhao & Li, 2016）                  | 18.45 |              1287 |

## 限制 / Limitations

- C-MAPSS 为单一工况的模拟数据；国泰机队需以实际发动机监测数据重新训练与验证。 / Single-condition simulation; retrain on Cathay engine-health data.
- 区间整体覆盖 88%，略低于名义 90%；临近失效段为 92%。 / Overall coverage is slightly below nominal.
- 换算为天时假设每天 1.5 循环。 / Day conversion assumes 1.5 cycles per day.
