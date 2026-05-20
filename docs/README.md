# CCR 文档索引

这里是 CCR 项目文档入口。文档按“长期技术资料”和“任务推进记录”分区维护，避免接入方案、todo、goal 和历史归档混在一起。

## 文档分区

- [文档分区说明](./documentation-layout.md)：新增文档前先按这里判断落点。
- [技术文档索引](./architecture/README.md)：架构、协议、provider、多模态、Desktop、发布与升级。
- [阶段任务目录](./stages/README.md)：todo、handoff、archive、当前指针。
- [阶段目标目录](./goals/README.md)：阶段目标、验收标准和完成记录。

## 当前版本与路线

- 当前公开版本：`0.5.0`，发布于 2026-05-20。
- 当前版本线：`0.5.x` 继续收敛多模态、多模型和工具调用。
- 下一条主线：`0.6.0` 进入 MCP、Skill、Plugin 与外部能力治理。
- 路线详情：[CCR 版本路线图](./architecture/version-roadmap.md)。
- 逐版本变化：[CHANGELOG.md](../CHANGELOG.md)。

## 技术设计

### 架构与协议

- [CCR 版本路线图](./architecture/version-roadmap.md)
- [CCR 多入口与 App Server 总体方案](./architecture/entrypoints-runtime-app-server-desktop-vscode.md)
- [CCR Core 统一对外接口边界](./architecture/ccr-core-interface-boundary.md)
- [CCR App Server 协议详细设计](./architecture/app-server-protocol-design.md)
- [CCR App Server 会话 API 设计](./architecture/app-server-session-api-design.md)
- [CCR App Server Client SDK 设计](./architecture/app-server-client-sdk-design.md)
- [CCR App Server 原生上下文链路恢复设计](./architecture/app-server-native-context-recovery.md)
- [CCR App Server 权限复用设计](./architecture/app-server-permission-reuse-design.md)
- [CCR App Server 版本、协议兼容与回滚规则](./architecture/app-server-version-compatibility.md)

### LLM Runtime、Provider 与多模态

- [内置通用 LLM Runtime 设计方案](./architecture/builtin-llm-runtime-design.md)
- [CCR 标准 LLM 协议](./architecture/ccr-standard-llm-protocol.md)
- [CCR LLM Provider 与多模态协议长期路线图](./architecture/llm-provider-protocol-long-term-roadmap.md)
- [CCR 协议统一化接入状态总账](./architecture/protocol-implementation-status.md)
- [CCR 多供应商模型与协议接入设计](./architecture/multi-provider-model-management-design.md)
- [CCR Provider 协议盘点与官方文档对照](./architecture/provider-protocol-inventory-and-official-docs.md)
- [CCR Provider 工具协议统一化标准](./architecture/provider-tool-protocol-normalization.md)
- [前台 Provider / Model 切换设计方案](./architecture/llm-frontend-provider-model-picker-design.md)
- [CCR 多模态输入输出设计](./architecture/multimodal-input-output-design.md)
- [CCR 模型输出归一化与展示标准](./architecture/model-output-normalization-and-display-standard.md)
- [供应商接入文档](./architecture/provider-integrations/README.md)

### 工程兼容与迁移

- [CCR 防冲突迁移清单](./architecture/ccr-conflict-isolation-migration.md)
- [Claude Code Reforged 依赖与 Shim 边界](./architecture/dependency-shim-boundary.md)

### Desktop、发布与升级

- [CCR 客户端产品与交互设计](./architecture/desktop-client-product-design.md)
- [CCR Desktop 客户端框架选型](./architecture/desktop-framework-selection.md)
- [CCR Desktop 输出展示与前端模块化方案](./architecture/desktop-output-display-and-modularization.md)
- [CCR Desktop 与 App Server 事件字段契约](./architecture/desktop-app-server-event-contract.md)
- [CCR Desktop 历史会话设计](./architecture/desktop-session-history-design.md)
- [CCR Desktop 日志与错误可观测方案](./architecture/desktop-logging-observability.md)
- [CCR Desktop 打包与升级准备方案](./architecture/desktop-packaging-and-upgrade-plan.md)
- [CCR Desktop 自动更新状态机](./architecture/desktop-auto-update-state-machine.md)
- [CCR Desktop GitHub Release 发布流程](./architecture/desktop-github-release-workflow.md)
- [CCR Desktop 发布验收 Runbook](./architecture/desktop-release-acceptance-runbook.md)
- [CCR 升级管理策略](./architecture/upgrade-management-strategy.md)

### MCP、参考与示例

- [MCP 文档入口](./mcp/README.md)
- [通用 MCP 接入规范](./mcp/integration-standard.md)
- [MCP 验证与排查手册](./mcp/verification-runbook.md)
- [Playwright MCP 接入设计](./mcp/playwright-integration-design.md)
- [MCP 示例配置](./examples/mcp/README.md)
- [OpenAI Codex 生成物源码对照索引](./references/openai-codex-generated-artifacts.md)
- [npm 发布流程](./release/npm-publish-workflow.md)

## 任务推进

- [CCR App Server 实施 Todo](./stages/app-server-todo.md)
- [CCR 多供应商模型与协议接入 Todo](./stages/multi-provider-model-management-todo.md)
- [CCR 多模态输入输出 Todo](./stages/multimodal-input-output-todo.md)
- [CCR 项目级 Settings 隔离 Todo](./stages/ccr-project-settings-isolation-todo.md)
- [CCR Desktop 历史会话 Todo](./stages/desktop-session-history-todo.md)
- [CCR Desktop 自动更新状态机 Todo](./stages/desktop-auto-update-todo.md)
- [CCR Desktop 安装包瘦身专项 Todo](./stages/desktop-packaging-slimming-todo.md)
- [CCR 工具能力治理修复清单](./stages/tool-capability-repair-list.md)
- [当前交接文档 2026-05-08](./stages/current-handoff-20260508.md)
- [历史会话恢复索引 2026-05-18](./stages/history-session-recovery-index-2026-05-18.md)
- [阶段目标目录](./goals/README.md)

## 修复与恢复

- [当前修复看板](./stages/current-repair-backlog.md)
- [修复与恢复资料索引](./recovery/README.md)
- [运行时缺失目标清单](./recovery/runtime-missing-targets.md)
- [ESM require 审计](./recovery/esm-require-audit.md)
- [依赖恢复清单](./recovery/dependency-recovery-checklist.md)
- [工程骨架恢复清单](./recovery/engineering-skeleton-recovery-checklist.md)
- [宏与构建适配清单](./recovery/macro-and-build-adaptation-checklist.md)
- [恢复修复方案](./recovery/recovery-repair-plan.md)
- [历史 backlog](./backlog-history/index.md)

## 协作规则

- [Agent 规则索引](./agent-detailed-rules.md)
- [详细规则目录](./agent-rules/index.md)

## 快速判断

- 要找“某能力怎么设计、怎么接”：看 `architecture/`。
- 要找“某厂商怎么接入”：看 `architecture/provider-integrations/`。
- 要找“现在做到哪、下一步是什么”：看 `stages/`。
- 要找“某轮为什么做、验收了什么”：看 `goals/`。
- 要找“修复恢复、审计清单、运行时缺口”：看 `recovery/`。
- 要找“外部源码证据”：看 `references/`。
