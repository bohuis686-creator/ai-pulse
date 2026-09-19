# 评分方法与边界 / Methodology

## 目的

检测同一配置在这组题目上的**可观测表现变化**，并提供逐题证据。它无法从回答反推出真实后台模型、算力分配、量化方式或平台动机。“AI 降智检测”是用户问题的通俗描述，不是本工具能作出的因果诊断。

## 题集

`pulse-1.0` 包含 24 道中文题，六类各四道。带种子的伪随机数生成器改变部分数值和检索键，固定种子确保复现。指令控制题等少量题目保持固定。模板公开，因此仍有污染和记忆风险；换种子不构成真正的保密题集。

上下文检索题使用 80 条简短记录；这只能作为短上下文检查。代码题检查代码理解，**不执行任何模型生成的代码**。本套题不测试多模态、工具调用或复杂开放创作，也未做外部心理测量或难度校准。

## 输入、评分和错误

- API：一个任务一个独立请求，只发送 user 消息，不指定 tools。
- 聊天：一次发送整套任务，共享同一上下文，因此单独分组比较。
- 每题分数只有 0 或 1，所有题权重相同；每类题数相等。
- 数字使用相对容差 `1e-8 × max(1, |expected|)`；类型必须为 JSON number。
- 字符串、布尔值、null 精确匹配，数组逐项且顺序敏感。
- API 要求 `{"answer":...}` 且无多余键；手动要求 ID→答案对象，缺失 ID 视为未通过。
- 可以容忍一层 Markdown JSON 代码围栏；不会从长段文字中搜索正确答案子串。
- 返回解释、错误类型或未按要求组织 JSON 可能构成格式失分。逐题原文用于复核，低分不一定意味着推理不足。
- 接口错误、空文本、内容过滤、token 截断不作为能力错误；自动测试立即停止，不保存部分结果为完整报告。

## 比较算法

1. 检查 suiteVersion、seed、模拟标记、mode、provider、requested model、repeats、maxTokens、temperature、reasoningEffort、tools 一致。
2. 含接口错误时拒绝判断；手动/低于 3 次重复的 API 仅显示分差。
3. 对每道题，计算 baseline 和 current 各次重复的平均 0/1 得分，作差，乘以 100 得到百分点差值。
4. 对 24 个配对题目差值有放回抽样 24 次，求均值；重复 2,000 次。重采样种子固定，结果可复现。
5. 使用排序样本第 50 与第 1949 项（零基下标）作为近似 2.5% / 97.5% 百分位区间。
6. 仅在整体下降 ≥10 个百分点且区间上界 <0 时提示下降信号。

抽样单位是题目，不把重复采样当作独立新题。它也**没有解决同类模板的相关性**，因此置信区间只能作为探索性参考。24 道题太少，不能用该区间声称对所有任务成立。10 个百分点是产品预警阈值，不是来自已发表校准研究。

重复 API 调用未设置服务商 seed，故输出可能有随机性；即使 temperature 为 0，平台也未必保证严格确定性。requested model 相同不代表后台快照相同，聊天界面中的用户标签也不可自动验证。模型版本更新、默认参数变化、隐藏提示词和网关路由都可能造成变化。

## 建议实验流程

建立多次正常运行的历史 → 固定测试配置 → 不同时间复测 → 查看具体失分题 → 使用另一个种子单独建立新基线复核。不要在看到结果后随意挑选“最好的一次”作为基线。不要把同一轮结果重复导入当作新观察。

记录版本、日期、明确的模型 ID 或聊天设置；若修改 token 上限、温度、思考强度或工具，重新建立基线。单独报告错误率和耗时，避免把服务稳定性与回答质量混为一谈。

## 英文摘要 / English summary

This is a small, public, Chinese-language regression probe. Binary answer checks and seeded inputs make results auditable, but the task set is not a calibrated intelligence benchmark. Comparisons require matching settings. A fixed 2,000-resample paired task bootstrap is applied only to runs with at least three repetitions per task. A drop of at least 10 percentage points with an interval below zero is labeled a signal, not proof of degradation or its cause. Template correlation, memorization, ceiling effects, stochasticity and hidden provider changes remain limitations.
