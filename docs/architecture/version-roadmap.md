# CCR 版本路线图

## 1. 定位

本文记录当前已发布版本、正在收敛的版本线，以及下一条大版本主线。它只保留版本层面的方向，不替代 `CHANGELOG.md` 的逐版本变更记录，也不替代 `docs/stages/` 下的实时 todo。

## 2. 当前发布版本

当前公开版本：`0.5.0`。

发布时间：2026-05-20。

发布入口：<https://github.com/mhdfy1988/cc-reforged/releases/tag/v0.5.0>

`0.5.0` 的核心范围：

- 多供应商配置、Profile、凭据和模型切换第一版。
- 多模态输入内容块、图片 / 文件草稿、发送前能力校验和历史恢复。
- Provider-neutral 图片生成链路，覆盖 OpenAI / Codex OAuth / MiniMax / GLM 等生成输出归一化。
- `GenerateImage` 模型可见工具，当前供应商不支持生图时返回友好提示。
- Desktop 输出展示、图片缩略图 / 预览、错误诊断、历史会话和工具卡片体验修复。
- Desktop Windows 安装包、发布资产校验、GitHub Release 公开发布和 unsigned 发布说明。

## 3. `0.5.x` 版本线

`0.5.x` 继续围绕“多模态、多模型、工具调用”做稳定化，不急着扩展外部生态。

重点方向：

- 已接 provider 成熟化：Codex OAuth、OpenAI、DeepSeek、MiniMax、Kimi、GLM 的真实 probe、错误分类和能力目录继续补齐。
- 图片和附件展示：生成图片、远程 URL 下载、本地持久化、历史恢复、预览失败兜底继续收敛。
- 工具调用治理：平台可用工具、权限卡、计划卡、工具进度、控制型工具和模型可见工具池继续修正。
- 会话与运行态：历史会话、运行中状态、上下文压缩、长诊断和请求卡死场景继续补观测。
- 发布质量：Windows 安装器、自动更新 feed、unsigned 校验、发布脚本可恢复性继续硬化。

第一版不做的事：

- 不默认跨供应商路由用户数据。
- 不把没有能力声明的模型标成全能模型。
- 不在 Desktop 直接解析 provider 原始响应。
- 不把 MCP / Skill / Plugin 主线提前塞进 `0.5.x`。

## 4. `0.6.0` 主线

`0.6.0` 进入扩展能力阶段，主线是 MCP、Skill、Plugin 和外部工具生态治理。

目标：

- 建立 MCP server 的安装、配置、健康检查、工具发现和权限边界。
- 让 Skill / Plugin 成为可发现、可启用、可审计的能力包，而不是散落的提示词或本地脚本。
- 将工具能力治理层前置到模型调用前，保证模型只看到当前真实可用的工具。
- 在 Desktop 中展示能力来源、健康状态、数据边界和失败原因。

第一版建议顺序：

1. 工具能力注册表：统一内置工具、MCP 工具、Plugin 工具、Agent 工具的可用状态。
2. MCP 健康检查：区分未配置、已配置未连接、连接中、工具列表可用、调用失败。
3. Skill / Plugin 清单：明确安装目录、元数据、启用状态和版本。
4. Desktop 能力面板：展示当前会话真实可用工具，而不是只展示配置文件。
5. 外部能力回归：把工具池、权限、错误快照和日志观测纳入 smoke。

## 5. 文档入口

- 逐版本变更：[../../CHANGELOG.md](../../CHANGELOG.md)
- 多供应商设计：[multi-provider-model-management-design.md](./multi-provider-model-management-design.md)
- 多模态设计：[multimodal-input-output-design.md](./multimodal-input-output-design.md)
- 标准 LLM 协议：[ccr-standard-llm-protocol.md](./ccr-standard-llm-protocol.md)
- Provider 接入文档：[provider-integrations/README.md](./provider-integrations/README.md)
- 工具能力治理清单：[../stages/tool-capability-repair-list.md](../stages/tool-capability-repair-list.md)
- MCP 文档入口：[../mcp/README.md](../mcp/README.md)
