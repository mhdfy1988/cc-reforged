# CCR 版本路线图

## 1. 定位

本文记录当前已发布版本、正在收敛的版本线，以及下一条大版本主线。它只保留版本层面的方向，不替代 `CHANGELOG.md` 的逐版本变更记录，也不替代 `docs/stages/` 下的实时 todo。

## 2. 当前发布版本

当前公开版本：`0.5.2`。

发布时间：2026-05-31。

发布入口：<https://github.com/mhdfy1988/cc-reforged/releases/tag/v0.5.2>

`0.5.2` 的核心范围：

- ThreadDisplay 历史恢复和实时展示统一到 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 与 Ordered Display Reducer。
- compact 后当前模型上下文和 UI 可见历史改为同源双投影，减少恢复旧上下文和历史裁剪问题。
- 并行工具、乱序结果、工具进度 / 失败 / 中断、用户图片和模型输出图片进入展示黄金回归覆盖。
- 新增模型调用使用事件流和 Desktop 使用统计页面，支持按 provider、profile、model、project 聚合。
- Desktop Windows 安装包、GitHub Release 公开发布、npm Trusted Publishing 和远端自动更新 feed 验证完成。

## 3. `0.5.x` 版本线

`0.5.x` 继续围绕“多模态、多模型、工具调用”做稳定化，并把 MCP 动态工具治理和基础管理面提前收进工具治理收尾。

当前实现状态（2026-05-31）：

- 会话上下文和展示链路已经完成一次集中收敛：当前模型上下文走 `currentContextMessages`，Desktop 历史 / 实时展示走 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。
- `thread/messages/list.result.messages` 保留为兼容载荷，不作为 UI 历史权威。
- 相关设计入口见 [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md) 和 [CCR ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md)。
- 这次收敛属于 `0.5.x` 稳定化范围，不改变 `0.6.0` Skill / Plugin 主线；后续如果继续做“全事件统一 ordered display reducer”，应按 [CCR 全事件统一 Ordered Display Reducer 设计方向](./thread-display-ordered-reducer-future-design.md) 作为单独架构 goal 进入 `0.5.x` 后续清理，而不是混入 provider 接入或 Desktop 视觉重构。

重点方向：

- 已接 provider 成熟化：Codex OAuth、OpenAI、DeepSeek、MiniMax、Kimi、GLM 的真实 probe、错误分类和能力目录继续补齐。
- 图片和附件展示：生成图片、远程 URL 下载、本地持久化、历史恢复、预览失败诊断继续收敛。
- 工具调用治理：平台可用工具、权限卡、计划卡、工具进度、控制型工具和模型可见工具池继续修正。
- MCP 管理面：收敛 MCP 工具注册、可用性、ToolSearch 候选、Desktop 来源展示、安装计划、启用/禁用、检测和 installer-owned 卸载，不重写 MCP client。
- 会话与运行态：历史会话、运行中状态、上下文压缩、长诊断和请求卡死场景继续补观测。
- 发布质量：Windows 安装器、自动更新 feed、unsigned 校验、发布脚本可恢复性继续硬化。

第一版不做的事：

- 不默认跨供应商路由用户数据。
- 不把没有能力声明的模型标成全能模型。
- 不在 Desktop 直接解析 provider 原始响应。
- 不把 Skill / Plugin 扩展包治理提前塞进 `0.5.x`。
- 不在 `0.5.x` 做完整插件市场、Skill / Plugin 安装启用和版本分发；MCP 只做工具治理与基础管理面闭环。

## 4. `0.6.0` 主线

`0.6.0` 进入扩展能力阶段，主线是 Skill、Plugin 和外部能力包治理；MCP 的基础工具治理应已在 `0.5.x` 收住。

目标：

- 让 Skill / Plugin 成为可发现、可启用、可审计的能力包，而不是散落的提示词或本地脚本。
- 在 MCP 基线之上补外部能力生态的安装、启用、命名空间、版本和审计。
- 将工具能力治理层前置到模型调用前，保证模型只看到当前真实可用的工具。
- 在 Desktop 中展示能力来源、健康状态、数据边界和失败原因。

第一版建议顺序：

1. Skill / Plugin 清单：明确安装目录、元数据、启用状态和版本。
2. Plugin 命名空间：处理插件 skill、agent、hook、MCP 配置的冲突和隔离。
3. Desktop 能力面板：展示当前会话真实可用工具，而不是只展示配置文件。
4. 外部能力回归：把工具池、权限、错误快照和日志观测纳入 smoke。

## 5. 文档入口

- 逐版本变更：[../../CHANGELOG.md](../../CHANGELOG.md)
- 多供应商设计：[multi-provider-model-management-design.md](./multi-provider-model-management-design.md)
- 多模态设计：[multimodal-input-output-design.md](./multimodal-input-output-design.md)
- 标准 LLM 协议：[ccr-standard-llm-protocol.md](./ccr-standard-llm-protocol.md)
- Provider 接入文档：[provider-integrations/README.md](./provider-integrations/README.md)
- 工具能力治理清单：[../stages/tool-capability-repair-list.md](../stages/tool-capability-repair-list.md)
- MCP 文档入口：[../mcp/README.md](../mcp/README.md)
