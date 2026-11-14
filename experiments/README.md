# 实验 / Experiments

每个实验使用独立目录，README 记录假设、输入来源、环境、复现命令、结果与限制。 / Give each experiment its own directory and document the hypothesis, input provenance, environment, reproduction command, results and limitations.

提交必要代码和小型合成输入，生成文件放入忽略的 `outputs/`。成熟功能经审阅后迁入应用或服务；新增实验语言需要自己的检查。 / Commit necessary code and small synthetic inputs; keep generated files in ignored `outputs/`. Move mature features into applications or services after review, and add checks for any new experiment language.

| 实验 / Experiment                            | 内容 / Contents                                            |
| -------------------------------------------- | ---------------------------------------------------------- |
| [rul-cmapss](rul-cmapss/README.md)           | 剩余使用寿命预测：MLP 集成 + 交叉共形区间 / RUL prediction |
| [joint-scheduler](joint-scheduler/README.md) | 联合排程与全年滚动模拟 / Joint scheduling and rolling year |
