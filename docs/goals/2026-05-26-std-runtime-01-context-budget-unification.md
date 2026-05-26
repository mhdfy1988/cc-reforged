# Goal: STD-RUNTIME-01 上下文预算统一治理

## 目标

把 CCR 运行时所有“上下文最大长度 / 有效输入窗口 / 自动压缩阈值 / 附件预算 / 工具搜索预算 / UI 展示”的计算收敛到同一个上下文预算模型，消除多 provider 接入后出现的来源分裂。

本 goal 要解决的核心问题是：

- DeepSeek 模型下拉显示 `1000K`，但顶部上下文显示 `180K`。
- 顶部可能显示 `1000K`，但会话在约 `168K` 自动压缩。
- 新 LLM 模型目录已经声明正确窗口，但旧压缩、分析、附件预算仍按 `200K` 默认窗口运行。

完成后，同一个 `provider/profile/model` 在所有运行链路里必须得到同一个 `totalContextWindow`，并从同一个预算对象推导压缩、告警和预算阈值。

## 总约束

- 不允许只修 Desktop 顶部显示来掩盖运行态错误。
- 不允许只对 DeepSeek 做硬编码特判。
- 不允许继续把旧 `getContextWindowForModel(model)` 当作 CCR 多 provider 主路径权威来源。
- 不允许各调用点自行计算 `contextWindow - reserved - buffer`。
- 可以保留 legacy Claude / TUI 兼容入口，但必须明确标注边界。
- 每个迁移调用点都要说明它消费的是 `totalContextWindow`、`effectiveInputWindow` 还是 `autoCompactThreshold`。

## 统一概念

- `totalContextWindow`：模型总上下文窗口。权威来源是当前 `provider/profile/model` 对应的模型目录。
- `maxOutputTokens`：模型最大输出 token。权威来源是当前模型目录或明确的 legacy 兼容口径。
- `reservedOutputTokens`：为普通输出、压缩摘要或特定任务预留的 token。
- `effectiveInputWindow`：实际可输入窗口，由 `totalContextWindow - reservedOutputTokens` 得出。
- `autoCompactThreshold`：自动压缩触发阈值，由 `effectiveInputWindow` 和自动压缩缓冲推导。
- `usedContextTokens`：当前会话已使用 token，来源于会话估算或 provider usage。

## 不变式

- 模型目录是多 provider 主路径的模型能力权威来源。
- 上下文预算 resolver 是上下文窗口、压缩阈值、附件预算和工具预算的唯一运行时权威入口。
- UI 只能展示预算 resolver 的结果，不能自行重算窗口。
- 压缩逻辑只能消费预算 resolver 的阈值，不能直接调用旧窗口函数后自行扣减。
- 新 provider 接入时必须先声明模型目录，再通过统一预算入口进入运行链路。

## 总体验收标准

- 同一个 `provider/profile/model` 在模型下拉、顶部上下文、自动压缩、context analyze、附件预算、工具搜索预算中使用同一个 `totalContextWindow`。
- 自动压缩阈值从统一预算对象推导，不再存在按 `200K` 默认值误触发的路径。
- Desktop 顶部不再把 `effectiveInputWindow` 误当成“模型最大上下文”展示。
- 切换模型会同步刷新当前配置预算和运行预算。
- 所有 legacy 调用都有清晰边界，不再混入 CCR 多 provider 主路径。

## 当前执行文档

执行 TODO：[CCR 上下文预算统一治理 Todo](../stages/context-budget-unification-todo.md)。

具体阶段、当前指针、调用点清单和验证记录只维护在 TODO 文档中；本 goal 只维护目标、边界、不变式和总体验收标准。

## 完成后下一步

完成本 goal 后，多 provider 成熟度矩阵需要补充一项“上下文预算一致性”，作为后续新 provider 接入的固定验收项。
