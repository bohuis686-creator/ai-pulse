# Contributing

欢迎提交评分错误、边界案例与有唯一答案的新题。

1. Fork 仓库，新建分支。
2. 修改 `web/core.js` 中的题库或评分函数。不要让模型输出作为可执行代码运行。
3. 涉及题目、提示词或评分语义时更新 `SUITE_VERSION`，让历史比较明确隔离不同版本。
4. 增加有实际意义的测试，运行 `npm test` 与 `npm run check`。
5. 提交 PR，说明问题、行为变化和验证结果。不要提交 API Key、`.env` 或个人报告。

题目应提供唯一答案、推导说明、稳定的 JSON 类型和可复现输入。先用独立算法核对答案；不要只测试“评分器认同生成器自身”。

For contributions, keep tasks deterministic, provide independently checked answer keys, bump the suite version when semantics change, and include meaningful tests. Please avoid dependency additions unless there is a clear benefit.
